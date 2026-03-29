let cachedHandler = null;
function loadBootstrapModule() {
  try {
    // Prefer current build output (dist/app.bootstrap.js)
    return require('../dist/app.bootstrap.js');
  } catch (error) {
    if (!error || error.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }

    // Fallback for previous output layout (dist/src/app.bootstrap.js)
    return require('../dist/src/app.bootstrap.js');
  }
}

async function getHandler() {
  if (cachedHandler) {
    return cachedHandler;
  }

  const { createApp } = loadBootstrapModule();
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
