import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        className: 'glass',
        style: {
          borderRadius: 'var(--radius)',
        },
      }}
      richColors
      closeButton
    />
  )
}

export { toast } from 'sonner'
