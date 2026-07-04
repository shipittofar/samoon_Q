/**
 * ConfigurationValidator — P9.0 / Phase E
 *
 * Pure validation of a value against its ConfigFieldDefinition. No UI logic,
 * no I/O. Named custom validators can be registered by feature modules that
 * need cross-field or async-adjacent (but still synchronous) rules.
 */
import type { ConfigFieldDefinition, ConfigValidationError, ConfigValidationResult } from './types'

type CustomValidator = (value: unknown, field: ConfigFieldDefinition) => string | null

const customValidators = new Map<string, CustomValidator>()

function registerRule(name: string, validator: CustomValidator): void {
  customValidators.set(name, validator)
}

function validateField(field: ConfigFieldDefinition, value: unknown): ConfigValidationError[] {
  const errors: ConfigValidationError[] = []
  const v = field.validation
  const isEmpty = value === undefined || value === null || value === ''

  if (v?.required && isEmpty) {
    errors.push({ fieldId: field.id, message: `${field.title} is required` })
    return errors
  }
  if (isEmpty) return errors

  switch (field.type) {
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        errors.push({ fieldId: field.id, message: `${field.title} must be a number` })
        break
      }
      if (v?.min !== undefined && value < v.min) {
        errors.push({ fieldId: field.id, message: `${field.title} must be ≥ ${v.min}` })
      }
      if (v?.max !== undefined && value > v.max) {
        errors.push({ fieldId: field.id, message: `${field.title} must be ≤ ${v.max}` })
      }
      break
    }
    case 'string':
    case 'password':
    case 'secret':
    case 'color':
    case 'font':
    case 'country':
    case 'language': {
      if (typeof value !== 'string') {
        errors.push({ fieldId: field.id, message: `${field.title} must be text` })
        break
      }
      if (v?.minLength !== undefined && value.length < v.minLength) {
        errors.push({ fieldId: field.id, message: `${field.title} must be at least ${v.minLength} characters` })
      }
      if (v?.maxLength !== undefined && value.length > v.maxLength) {
        errors.push({ fieldId: field.id, message: `${field.title} must be at most ${v.maxLength} characters` })
      }
      if (v?.pattern && !new RegExp(v.pattern).test(value)) {
        errors.push({ fieldId: field.id, message: `${field.title} does not match the required format` })
      }
      break
    }
    case 'boolean':
    case 'feature_flag': {
      if (typeof value !== 'boolean') {
        errors.push({ fieldId: field.id, message: `${field.title} must be true or false` })
      }
      break
    }
    case 'select':
    case 'permission': {
      const allowed = field.options?.map((o) => o.value) ?? v?.enumValues
      if (allowed && !allowed.includes(value as never)) {
        errors.push({ fieldId: field.id, message: `${field.title} must be one of the allowed options` })
      }
      break
    }
    case 'multi-select': {
      if (!Array.isArray(value)) {
        errors.push({ fieldId: field.id, message: `${field.title} must be a list` })
        break
      }
      const allowed = field.options?.map((o) => o.value)
      if (allowed) {
        for (const item of value) {
          if (!allowed.includes(item)) {
            errors.push({ fieldId: field.id, message: `${field.title} contains an invalid option: ${String(item)}` })
          }
        }
      }
      break
    }
    case 'array': {
      if (!Array.isArray(value)) {
        errors.push({ fieldId: field.id, message: `${field.title} must be a list` })
      }
      break
    }
    case 'object':
    case 'json': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push({ fieldId: field.id, message: `${field.title} must be an object` })
      }
      break
    }
  }

  if (v?.custom) {
    const rule = customValidators.get(v.custom)
    if (!rule) {
      errors.push({ fieldId: field.id, message: `Unknown custom validator "${v.custom}"` })
    } else {
      const message = rule(value, field)
      if (message) errors.push({ fieldId: field.id, message })
    }
  }

  return errors
}

function validate(field: ConfigFieldDefinition, value: unknown): ConfigValidationResult {
  const errors = validateField(field, value)
  return { valid: errors.length === 0, errors }
}

function validateMany(entries: Array<{ field: ConfigFieldDefinition; value: unknown }>): ConfigValidationResult {
  const errors = entries.flatMap(({ field, value }) => validateField(field, value))
  return { valid: errors.length === 0, errors }
}

export const configurationValidator = {
  registerRule,
  validate,
  validateMany,
}
