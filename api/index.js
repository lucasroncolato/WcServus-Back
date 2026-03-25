let cachedHandler = null;

async function getHandler() {
  if (cachedHandler) {
    return cachedHandler;
  }

  // Load compiled app to avoid TS path-alias resolution issues in serverless runtime.
  const { createApp } = require('../dist/src/app.bootstrap.js');
  const app = await createApp();
  await app.init();

  cachedHandler = app.getHttpAdapter().getInstance();
  return cachedHandler;
}

module.exports = async (req, res) => {
  try {
    const handler = await getHandler();
    return handler(req, res);
  } catch (error) {
    console.error('Serverless bootstrap error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        statusCode: 500,
        message: 'Internal server error during function bootstrap',
      }),
    );
  }
};
