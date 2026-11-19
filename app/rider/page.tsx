import RiderApp from "@/components/flyt/rider-app"
import { getRiderDemoData } from "@/lib/api"

export default async function RiderPage() {
  const initialData = await getRiderDemoData()
  return <RiderApp initialData={initialData} />
}
