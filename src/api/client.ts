/**
 * Shared HTTP client for RBAC D2 API modules.
 * All src/api/* modules must use this — no duplicate axios instances.
 */
import api from '@/services/axios.instance'

export default api
