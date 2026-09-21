import { requireCsrf } from "./sessionPolicy.js";

const STAFF_ROLES = Object.freeze(["RECEPTION", "KITCHEN", "MANAGER", "ADMIN"]);

// Adaptación para inyectar el resolvedor de identidad en las pruebas.
export function createAuthorization({ resolveAuthentication }) {
async function authenticateContext(request, reply, context) {
  const auth = await resolveAuthentication(request, {
    context,
    // Las rutas del navegador usan cookies separadas. Los Bearer JWT se reservan
    // para la sesión de cliente/API estándar y no puentean el área interna.
    allowBearer: context !== "admin"
  });
  if (!auth?.identity?.sub) {
    return reply.code(401).send({
      error: "AUTHENTICATION_REQUIRED",
      message: context === "admin"
        ? "Necesitás iniciar una sesión interna."
        : "Necesitás iniciar sesión."
    });
  }
  request.auth = auth;
}

const authenticate = (request, reply) => authenticateContext(request, reply, "customer");
const authenticateAdmin = (request, reply) => authenticateContext(request, reply, "admin");

function roleGuard(context, roles) {
  return async function guard(request, reply) {
    if (!request.auth?.identity?.sub || request.auth.context !== context) {
      const result = await authenticateContext(request, reply, context);
      if (result) return result;
    }
    const granted = new Set(request.auth.identity.roles || []);
    if (!roles.some((role) => granted.has(role))) {
      return reply.code(403).send({
        error: "FORBIDDEN",
        message: context === "admin"
          ? "La cuenta ingresada no pertenece al equipo autorizado."
          : "Tu cuenta no tiene permisos para esta operación."
      });
    }
  };
}

const requireRoles = (...roles) => roleGuard("customer", roles);
const requireAdminRoles = (...roles) => roleGuard("admin", roles);

async function protectContextMutation(request, reply, context) {
  const result = await authenticateContext(request, reply, context);
  if (result) return result;
  requireCsrf(request);
}

const protectMutation = (request, reply) => protectContextMutation(request, reply, "customer");
const protectAdminMutation = (request, reply) => protectContextMutation(request, reply, "admin");

return { authenticate, authenticateAdmin, requireRoles, requireAdminRoles, protectMutation, protectAdminMutation, STAFF_ROLES };
}

