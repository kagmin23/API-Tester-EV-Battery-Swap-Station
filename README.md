# API-Tester-EV-Battery-Swap-Station
## Role-based access control

Three roles are supported: `admin`, `driver`, `staff`.

- New registrations default to role `driver`.
- Only an authenticated `admin` can create users with a specific role by sending a `role` field to `/api/auth/register`.
- JWT now includes `id`, `email`, and `role`.
- Use the provided middleware:
	- `authenticate` to require a valid Bearer token
	- `authorizeRoles('admin', 'staff')` to restrict endpoints by roles

Example protected routes have been added under `/users`:

- `GET /users/admin-only` → admin only
- `GET /users/staff-or-driver` → staff, driver, or admin

## Vehicle APIs

All vehicle endpoints require Authorization: Bearer <accessToken>

Base path: `/api/vehicles`

- POST `/` link vehicle to current user
	- body: { vin, battery_model?, license_plate, car_name?, brand?, model_year? }
	- returns created vehicle with `vehicle_id`

- GET `/` list vehicles of current user
	- admin can pass `?all=true` to list all vehicles

- GET `/:id` get one vehicle by `vehicle_id`

- PATCH `/:id` update fields: battery_model, license_plate, car_name, brand, model_year

- DELETE `/:id` delete vehicle (owner or admin)
