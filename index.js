import fs from 'fs';
import https from 'https';

/**
 * @param {string} specifier
 * @param {{ conditions: string[], parentURL: string | undefined }} context
 * @param {function} defaultResolve
 * @returns {Promise<{ url: string }>}
 */
export async function resolve(specifier, context, defaultResolve) {
  /** @type {URL} */
  let url;

  // Attempt to parse the specific to a URL
  try {
    url = new URL(specifier);
  }

  // Defer to Node for non-URL specifiers
  catch (error) {
    return defaultResolve(specifier, context, defaultResolve);
  }

  // Defer to Node for non-HTTP/non-HTTPS URL specifiers
  if (url.protocol === 'file:') {
    return defaultResolve(specifier, context, defaultResolve);
  }

  // Derive a path from the URL to look for and keep the downloaded module in
  const path = process.cwd() + '/node_modules/' + url.hostname + url.pathname;
  const match = path.match(/^(?<directoryPath>.*?)(?<fileName>\/\w+\.js)?$/);
  const directoryPath = match.groups.directoryPath;
  const filePath = directoryPath + (match.groups.fileName ?? '/index.js');

  // Return the downloaded module if exists
  try {
    await fs.promises.access(filePath);
    return { url: 'file:' + filePath };
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  // Create `node_modules/…` for the downloaded module
  try {
    await fs.promises.mkdir(directoryPath, { recursive: true });
  }
  catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }

  // Download the module
  await fs.promises.writeFile(filePath, await download(specifier));
  await fs.promises.writeFile(directoryPath + '/package.json', '{ "type": "module" }\n');
  return { url: 'file:' + filePath };
}

function download(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, async response => {
      const buffers = [];
      for await (const buffer of response) {
        buffers.push(buffer);
      }

      resolve(Buffer.concat(buffers))
    });

    request.on('error', reject);
  });
}
