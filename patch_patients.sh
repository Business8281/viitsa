#!/bin/bash
sed -i '' "s|import { supabase } from '../lib/supabase';|import { db } from '../lib/firebase';\\
import { collection, addDoc } from 'firebase/firestore';|g" src/screens/PatientsScreen.tsx

sed -i '' "s|const { error } = await supabase.from('patients').insert(payload);|try { await addDoc(collection(db, 'patients'), payload); } catch (e) { const error = e; |g" src/screens/PatientsScreen.tsx
