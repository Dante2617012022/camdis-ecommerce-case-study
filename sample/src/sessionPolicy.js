const SESSION_CONTEXTS = new Set(["customer", "admin"]);

export function assertSessionContext(context) {
  if (!SESSION_CONTEXTS.has(context)) {
    const error = new Error("Contexto de sesión inválido");
    error.code = "SESSION_CONTEXT_INVALID";
    throw error;
  }
  return context;
}

export function identityForContext(identity, context) {
  const safeContext = assertSessionContext(context);
  if (safeContext === "customer") {
    return {
      ...identity,
      // Los roles internos nunca atraviesan el límite del cliente público.
      // Una cuenta del equipo que use la tienda se comporta como CUSTOMER.
      roles: ["CUSTOMER"]
    };
  }
  return identity;
}

export function requireCsrf(request) {
  if (request.auth?.type !== "session") return;
  const candidate = request.headers["x-csrf-token"];
  if (!candidate || candidate !== request.auth.csrfToken) {
    const error = new Error("Token CSRF inválido o ausente");
    error.statusCode = 403;
    error.code = "CSRF_INVALID";
    throw error;
  }
}

