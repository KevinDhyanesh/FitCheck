export async function requestApi(route, data, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(`/api/${route}`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data), signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    throw new Error(error.name === 'TimeoutError'
      ? 'The store request timed out. Try again or upload its size-chart photo.'
      : 'Fitcheck cannot reach its server. Run npm.cmd start in the Fitcheck folder and reload this page.');
  }
  let result;
  try { result = await response.json(); }
  catch { throw new Error('This page is not connected to the Fitcheck API. Open the address shown by npm.cmd start.'); }
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}). Try again or upload a chart photo.`);
  return result;
}
