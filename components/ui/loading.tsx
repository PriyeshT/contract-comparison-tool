import { Loader2 } from "lucide-react"

export function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
} 