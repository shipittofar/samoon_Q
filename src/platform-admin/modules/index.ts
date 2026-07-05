/**
 * Platform Administration modules — P9.4 Phase C
 *
 * Importing this module registers every Platform Administration module as
 * a side effect, exactly like `src/config/index.ts` does for the original
 * P9.0–P9.2 modules (Rule 2 — Registry First). Order doesn't matter here
 * (none of these modules declare cross-module `dependencies`).
 */
import './platform'
import './users'
import './businesses'
import './subscriptions'
import './security'
import './monitoring'
import './infrastructure'
import './automation'
import './developer'
import './support'
