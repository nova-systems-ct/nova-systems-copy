import { TrainingList } from '../../components/sales/Training'

// Nova Sales Academy — program list. The learner experience lives in components/sales/Training.jsx so the rep workspace (/rep/training)
// and Nova HQ (/dashboard/academy) share one implementation against api/academy.js (server-side grading, attempts, certificates).
export default function Academy() {
  return <TrainingList basePath="/dashboard/academy" />
}
