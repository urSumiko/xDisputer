# Notifications Feature Slice

Owns notification list, notification bell, unread/read state, and notification routing.

Modernization targets:

- use server-state fetching for notification data after TanStack Query is installed
- keep optimistic changes only for low-risk read-state actions
- expose empty and error states consistently
- share notification identity with the frontend-control registry
