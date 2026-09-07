import { notFound } from 'next/navigation'
import { isDemoSurfaceAvailable } from '@/lib/demo/contract'
import DevLoginClient from './DevLoginClient'

export default function DevLoginPage() {
  if (!isDemoSurfaceAvailable()) notFound()
  return <DevLoginClient />
}
