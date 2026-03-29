let cachedHandler = null;
const path = require('path');
const fs = require('fs');

function resolveBootstrapPath() {
  const candidates = ['../dist/app.bootstrap.js', '../dist/src/app.bootstrap.js'];

  for (const candidate of candidates) {
    const absolutePath = path.resolve(__dirname, candidate);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  throw new Error(
    `Bootstrap file not found. Tried: ${candidates.map((candidate) => path.resolve(__dirname, candidate)).join(', ')}`,
  );
}

async function getHandler() {
  if (cachedHandler) {
    return cachedHandler;
  }

  const bootstrapPath = resolveBootstrapPath();
  const { createApp } = require(bootstrapPath);
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
