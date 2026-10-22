const parseSetCookie = (header) => {
  const [pair, ...attributes] = header.split(';');
  const separator = pair.indexOf('=');
  const name = pair.slice(0, separator).trim();
  const value = pair.slice(separator + 1).trim();
  const expired = attributes.some((attribute) => {
    const [key, rawValue] = attribute.split('=');
    const normalizedKey = key.trim().toLowerCase();
    if (normalizedKey === 'max-age') {
      return Number.parseInt(rawValue, 10) <= 0;
    }
    if (normalizedKey === 'expires') {
      return Date.parse(rawValue) < Date.now();
    }
    return false;
  });
  return { name, value, expired };
};

export const createHttpClient = (baseUrl) => {
  const cookies = new Map();

  const request = async (method, path, { json, form, headers = {} } = {}) => {
    const init = { method, headers: { ...headers } };

    if (cookies.size > 0) {
      init.headers.cookie = [...cookies]
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
    }
    if (json !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(json);
    }
    if (form) {
      init.body = form;
    }

    const response = await fetch(`${baseUrl}${path}`, init);
    const setCookie = response.headers.getSetCookie();

    for (const header of setCookie) {
      const { name, value, expired } = parseSetCookie(header);
      if (!value || expired) {
        cookies.delete(name);
      } else {
        cookies.set(name, value);
      }
    }

    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    return {
      status: response.status,
      headers: response.headers,
      body,
      setCookie,
    };
  };

  return {
    get: (path, options) => request('GET', path, options),
    post: (path, options) => request('POST', path, options),
    patch: (path, options) => request('PATCH', path, options),
    delete: (path, options) => request('DELETE', path, options),
    hasCookie: (name) => cookies.has(name),
    clearCookies: () => cookies.clear(),
  };
};

export const createImageForm = ({
  fieldName = 'avatar',
  filename = 'avatar.png',
  type = 'image/png',
  size = 128,
} = {}) => {
  const form = new FormData();
  form.append(fieldName, new Blob([Buffer.alloc(size, 1)], { type }), filename);
  return form;
};
