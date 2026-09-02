import { EVIQO_WEB_CLIENT_VERSION, logger } from 'eviqo-client-api';

// Kept temporarily because the handshake-test CLI imports this module.
// The protocol compatibility logic now lives in the client implementation
// itself; this file no longer modifies prototypes at runtime.
logger.info(
  `Using built-in Eviqo web handshake implementation ${EVIQO_WEB_CLIENT_VERSION}`
);
