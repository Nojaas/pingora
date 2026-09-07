export function getDashboardApiConfig() {
  const baseUrl = (process.env.PINGORA_API_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const apiKey = process.env.PINGORA_API_KEY?.trim();

  return { baseUrl, apiKey };
}
