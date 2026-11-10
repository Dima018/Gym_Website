export const token = () => sessionStorage.getItem("ritm_token");
export function logout() {
  sessionStorage.removeItem("ritm_token");
}
export async function api(url, { method = "GET", body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch("/api" + url, {
      method,
      signal: controller.signal,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token() ? { Authorization: "Bearer " + token() } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = res.status === 204 ? null : await res.json();
    if (!res.ok) {
      if (res.status === 401) logout();
      const error = new Error(
        data?.error?.message || "Не вдалося виконати запит.",
      );
      error.status = res.status;
      error.fields = data?.error?.fields;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("Сервер не відповідає. Спробуйте ще раз.");
    if (error instanceof TypeError)
      throw new Error(
        "Немає з’єднання із сервером. Перевірте мережу та спробуйте ще раз.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
