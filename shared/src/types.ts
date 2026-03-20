// Shared types between web and api

export interface ApiResponse<T> {
  data: T
  message: string
}
