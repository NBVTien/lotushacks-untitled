import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        className: 'glass',
        style: {
          borderRadius: 'var(--radius)',
        },
      }}
      richColors
      closeButton
      theme="system"
    />
  )
}

export { toast } from 'sonner'
