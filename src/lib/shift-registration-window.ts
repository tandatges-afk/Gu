import 'server-only';
import {db} from './firebase-admin';
import {effectiveRegistrationPeriod,upcomingRegistrationWeek,type EarlyRegistrationWindow} from './shift-schedule';
/** One indexed lookup, never accept a staff-supplied registration deadline. */
export async function activeRegistrationPeriod(now=new Date()){
 const nextWeek=upcomingRegistrationWeek(now);
 const snap=await db().collection('shiftRegistrationWindows').doc(nextWeek).get();
 return effectiveRegistrationPeriod(now,snap.exists?snap.data() as EarlyRegistrationWindow:null);
}
