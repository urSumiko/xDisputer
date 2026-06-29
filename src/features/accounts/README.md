# Accounts Feature Slice

Owns master, manager, client, disputer/account directory, account profile, invitations, and role-specific account surfaces.

Modernization targets:

- move account UI into small presentational components
- keep role/account access decisions in server policies
- use server-state fetching only for account/profile data
- keep table search/filter/sort states explicit
