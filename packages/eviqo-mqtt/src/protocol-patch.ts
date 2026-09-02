import {
  calculateHash,
  EviqoWebsocketConnection,
  logger,
} from 'eviqo-client-api';

const CURRENT_WEB_VERSION = '0.109.0';
const LOCALE = 'en_US';

interface InternalClientState {
  username: string | null;
  password: string | null;
  user: unknown;
  messageCounter: number;
}

interface ResponseHeader {
  byte1: number;
  byte2: number;
  byte3: number;
  byte4: number;
}

function requireHeader(
  stage: string,
  header: ResponseHeader | null,
  expected: [number, number, number, number]
): void {
  if (header === null) {
    throw new Error(`${stage}: no response header received`);
  }

  const actual = [header.byte1, header.byte2, header.byte3, header.byte4];
  const matches = actual.every((value, index) => value === expected[index]);
  if (!matches) {
    const format = (bytes: number[]) =>
      bytes.map((value) => value.toString(16).padStart(2, '0')).join(' ');
    throw new Error(
      `${stage}: unexpected response header ${format(actual)}; expected ${format(expected)}`
    );
  }
}

EviqoWebsocketConnection.prototype.issueInitialization = async function (): Promise<void> {
  logger.info(`Using Eviqo web protocol version ${CURRENT_WEB_VERSION}`);

  await this.sendMessage(
    {
      clientType: 'web',
      version: CURRENT_WEB_VERSION,
      locale: LOCALE,
    },
    0x01,
    0x30,
    0x00,
    0x01,
    'INIT CURRENT'
  );

  const result = await this.listen();
  requireHeader('INIT', result.header, [0x00, 0x63, 0x00, 0x01]);
  if (result.payload === null) {
    throw new Error('INIT: response payload missing');
  }
};

EviqoWebsocketConnection.prototype.login = async function (): Promise<void> {
  const internal = this as unknown as InternalClientState;

  if (internal.username === null || internal.password === null) {
    throw new Error('User and password must be set');
  }

  await this.sendMessage(
    {
      email: internal.username,
      hash: calculateHash(internal.username, internal.password),
      clientType: 'web',
      version: CURRENT_WEB_VERSION,
      locale: LOCALE,
    },
    0x00,
    0x02,
    0x00,
    0x03,
    'LOGIN CURRENT'
  );

  let result = await this.listen();
  requireHeader('LOGIN', result.header, [0x00, 0x02, 0x00, 0x03]);
  if (result.payload === null) {
    throw new Error('LOGIN: response payload missing');
  }
  internal.user = result.payload;

  // Current official web client sends a four-byte bootstrap request after login.
  await this.sendMessage(null, 0x00, 0xef, 0x00, 0x05, 'BOOTSTRAP CURRENT');
  result = await this.listen();
  requireHeader('BOOTSTRAP', result.header, [0x00, 0xef, 0x00, 0x05]);
  if (result.payload === null) {
    throw new Error('BOOTSTRAP: response payload missing');
  }

  // Followed by a DEVICE document metadata request.
  await this.sendMessage(
    { docType: 'DEVICE' },
    0x01,
    0x1c,
    0x00,
    0x07,
    'DEVICE METADATA CURRENT'
  );
  result = await this.listen();
  requireHeader('DEVICE METADATA', result.header, [0x01, 0x1c, 0x00, 0x07]);
  if (result.payload === null) {
    throw new Error('DEVICE METADATA: response payload missing');
  }

  // The existing queryDevices() method auto-assigns byte4 from messageCounter.
  // Set it to 0x09 so the next request exactly matches the official web client.
  internal.messageCounter = 0x09;

  logger.info('Current Eviqo startup handshake completed through DEVICE metadata');
};

logger.info('Loaded current Eviqo protocol handshake patch');
