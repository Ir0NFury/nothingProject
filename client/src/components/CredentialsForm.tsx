import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { getFieldErrors } from '../api/fieldErrors'

type Field = 'email' | 'password'

type Props = {
  submitLabel: string
  passwordAutoComplete: 'current-password' | 'new-password'
  onSubmit: (email: string, password: string) => Promise<void>
}

// Shared by the login and register pages. The server does all validation.
export function CredentialsForm({ submitLabel, passwordAutoComplete, onSubmit }: Props) {
  const id = useId()
  const [values, setValues] = useState<Record<Field, string>>({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function update(field: Field, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormError(null)
    setFieldErrors({})
    try {
      await onSubmit(values.email, values.password)
    } catch (err) {
      const errors = getFieldErrors<Field>(err)
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
      } else if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
        setFieldErrors({ email: err.message })
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const fields: { name: Field; label: string; type: string; autoComplete: string }[] = [
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
    { name: 'password', label: 'Password', type: 'password', autoComplete: passwordAutoComplete },
  ]

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {formError && <p role="alert" className="form-error">{formError}</p>}
      {fields.map(({ name, label, type, autoComplete }) => {
        const inputId = `${id}-${name}`
        const errorId = `${inputId}-error`
        const error = fieldErrors[name]
        return (
          <div className="field" key={name}>
            <label htmlFor={inputId}>{label}</label>
            <input
              id={inputId}
              name={name}
              type={type}
              autoComplete={autoComplete}
              value={values[name]}
              onChange={(e) => update(name, e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            {error && <p id={errorId} className="field-error">{error}</p>}
          </div>
        )
      })}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Please wait…' : submitLabel}
      </button>
    </form>
  )
}
