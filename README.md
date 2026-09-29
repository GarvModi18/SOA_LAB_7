# Web Services & SOA Laboratory — Lab 7
## API Gateway, Configuration-Based Service Discovery & Cloud Deployment
**Author:** Garv Modi  
**Course:** Web Services & Service Oriented Architecture (SOA) Lab  

---

## 1. Project Overview & Architecture Evolution

In **Lab 6**, the system decomposed the monolithic backend into three independently runnable microservices (*User Service*, *Product Service*, *Order Service*) communicating over a Docker network, where clients accessed each service directly on separate ports (`3001`, `3002`, `3003`).

In **Lab 7**, we introduce an **API Gateway (`api-gateway`)** as the single unified entry point for all external client traffic. The gateway acts as a reverse proxy, abstracts backend network topology, handles cross-cutting concerns (logging, centralized error handling, and health checks), and leverages a **configuration-based service discovery layer** to dynamically resolve microservice locations without code changes. Finally, the entire containerized architecture is structured for cloud deployment with MongoDB Atlas.

---

### End-to-End System Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                 Client / Postman                                  |
|                            (Public Internet / HTTPS)                              |
+-----------------------------------------------------------------------------------+
                                         |
                                         | (:3000) [Only Public Port Exposed]
                                         v
+-----------------------------------------------------------------------------------+
|                         CampusConnect API Gateway                                 |
|  - Reverse Proxy Routing (/users, /products, /orders)                             |
|  - Request Logging Middleware (Method, Path, Target, Status, Duration)            |
|  - Centralized Error Handling (502 Bad Gateway / 503 Service Unavailable)         |
|  - Gateway Health Check (GET /health)                                             |
|  - Dynamic Service Registry (Config / Environment-Driven)                         |
+-----------------------------------------------------------------------------------+
           |                                  |                                 |
           | USER_SERVICE_URL                 | PRODUCT_SERVICE_URL             | ORDER_SERVICE_URL
           v                                  v                                 v
+-----------------------------------------------------------------------------------+
|                    DOCKER INTERNAL BRIDGE NETWORK (campus-network)                |
|                    [User, Product, Order Isolated from Public Host]               |
|                                                                                   |
|  +--------------------+        +--------------------+       +------------------+  |
|  |    User Service    |        |  Product Service   |       |  Order Service   |  |
|  |     (Port 3001)    |        |    (Port 3002)     |       |   (Port 3003)    |  |
|  +--------------------+        +--------------------+       +------------------+  |
|            |                             |                    |       |           |
|            |                             |                    |  REST | Inter-Svc |
|            |                             +<-------------------+       |           |
|            +<---------------------------------------------------------+           |
|            |                                                                      |
|            +-----------------------------+-----------------------------+          |
|                                          |                                        |
+------------------------------------------|----------------------------------------+
                                           v
+-----------------------------------------------------------------------------------+
|                         Persistent Database Layer                                 |
|       Local: Containerized MongoDB Engine (campus-mongodb :27017)                 |
|       Cloud: MongoDB Atlas Cluster (Separate Database Names per Microservice)     |
|          - campusconnect_users                                                    |
|          - campusconnect_products                                                 |
|          - campusconnect_orders                                                   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Part A — Build a Real API Gateway

### Why Introduce an API Gateway Instead of Direct Service Calls? (Discussion Answer)

Exposing individual microservices directly to client applications creates severe architectural drawbacks:
1. **Single Entry Point & Protocol Decoupling:** Clients only need to know a single domain/port (`http://localhost:3000` or a public cloud URL) rather than tracking disparate host ports (`3001`, `3002`, `3003`).
2. **Encapsulation & Topology Hiding:** Internal microservice hostnames, container network addresses, and scaling replicas are kept completely private inside the Docker network. The backend can refactor, rename, or split services without breaking client contracts.
3. **Centralized Cross-Cutting Concerns:** Cross-cutting logic such as request logging, correlation IDs, authentication/authorization, rate limiting, and CORS headers are implemented once at the gateway level rather than duplicated across every microservice.
4. **Centralized Fault Tolerance:** When a downstream service crashes or encounters network partition, the gateway traps the socket failure and immediately formats an RFC-compliant HTTP `502 Bad Gateway` or `503 Service Unavailable` JSON response, preventing client-side timeouts or unhandled promise crashes.
5. **Security Hardening:** In `compose.yaml`, only the gateway port (`3000`) is published to the host machine. All microservices (`user-service`, `product-service`, `order-service`) and database engines are accessible only within `campus-network`.

### Gateway Implementation Highlights (`api-gateway/server.js`)

- **Routing & Reverse Proxying:** Built with Express and `http-proxy-middleware` (`createProxyMiddleware`) with `fixRequestBody` to preserve JSON payload streams across proxy boundaries.
- **Request Logging:** Custom logging middleware recording timestamp, HTTP method, requested route, downstream service target, response HTTP status code, and latency duration in milliseconds.
- **Health Check Endpoint (`GET /health`):** Returns gateway status, uptime, node version, and the active service registry mapping.
- **Centralized 502/503 Error Handling:** Traps `ECONNREFUSED`, `ENOTFOUND`, and timeout events on the proxy stream, returning structured JSON error payloads.

---

## 3. Part B — Service Discovery (Configuration-Based)

### Configuration-Based Service Registry (`api-gateway/config/serviceRegistry.js`)

Service locations are externalized into environment variables and config files:

```javascript
const serviceRegistry = {
  port: parseInt(process.env.PORT || '3000', 10),
  services: {
    user: {
      name: 'User Service',
      prefix: '/users',
      url: process.env.USER_SERVICE_URL || 'http://localhost:3001',
      timeoutMs: parseInt(process.env.USER_SERVICE_TIMEOUT_MS || '5000', 10)
    },
    product: {
      name: 'Product Service',
      prefix: '/products',
      url: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
      timeoutMs: parseInt(process.env.PRODUCT_SERVICE_TIMEOUT_MS || '5000', 10)
    },
    order: {
      name: 'Order Service',
      prefix: '/orders',
      url: process.env.ORDER_SERVICE_URL || 'http://order-service:3003',
      timeoutMs: parseInt(process.env.ORDER_SERVICE_TIMEOUT_MS || '5000', 10)
    }
  }
};
```

### Static / Config-Based Discovery vs. Dynamic Service Discovery

| Feature | Static / Config-Based Discovery (This Lab) | Dynamic Service Discovery (Consul / Eureka / K8s DNS) |
| :--- | :--- | :--- |
| **Registration Mechanism** | Manual configuration via `.env` or environment variables at startup | Automatic self-registration via SDK, sidecar, or orchestrator API on boot |
| **Instance Scaling** | Requires manual configuration update and gateway reload for each replica | Automatically registers and deregisters instances as pods/containers scale up or down |
| **Health Awareness** | Gateway learns an instance is down only when proxying fails (reactive 502/503) | Active heartbeat / health-check probing; automatically evicts unhealthy instances from routing pool |
| **Load Balancing** | Relies on static DNS round-robin or external L4 load balancer | Dynamic client-side load balancing (e.g. Round-Robin, Least Connection, Weighted) |
| **Operational Complexity** | Low complexity; zero extra infrastructure dependencies | Higher complexity; requires running dedicated discovery clusters (Consul agents, Eureka servers) |

---

## 4. Part C — Cloud Deployment Guide

### Deployment Options for Microservices & API Gateway

You can deploy the containerized microservices stack to any modern cloud container provider:

#### Option 1: Render Blueprints (1-Click Deployment via `render.yaml`)
1. **Database:** Ensure your MongoDB Atlas cluster has network access set to `0.0.0.0/0` (Allow from Anywhere).
2. **Push Code:** Push this repository containing `render.yaml` to GitHub.
3. **Deploy with Blueprint:**
   - In [Render Dashboard](https://dashboard.render.com/), click **New +** $\rightarrow$ **Blueprint**.
   - Connect your GitHub repository. Render will parse `render.yaml` and auto-configure all 4 services.
   - Enter your MongoDB Atlas URIs when prompted for `MONGO_URI`.
   - Click **Apply** — Render automatically spins up `campus-api-gateway`, `campus-user-service`, `campus-product-service`, and `campus-order-service` with internal networking pre-wired!
4. **Public Gateway:** Access the public URL generated for `campus-api-gateway` (e.g. `https://campus-api-gateway.onrender.com`).

#### Option 2: Single VM / App Service (AWS EC2 / GCP Compute / Azure VM)
1. Install Docker & Docker Compose on the VM.
2. Clone repository and set `.env` with cloud Atlas URIs.
3. Run `docker compose up -d --build`.
4. Expose only port `3000` through the cloud firewall / Security Group.

---

## 5. Gateway Endpoints Reference

All client calls are sent through the Gateway port (`http://localhost:3000` or public cloud URL):

| Gateway Route | HTTP Method | Target Service | Purpose | Sample Request Body / Parameter |
| :--- | :--- | :--- | :--- | :--- |
| `/health` | `GET` | API Gateway | Check gateway status & routing registry | None |
| `/users` | `POST` | User Service | Register new student or faculty | `{"name":"Garv","email":"garv@uni.edu","role":"student"}` |
| `/users` | `GET` | User Service | Retrieve list of all users | Query filters optional |
| `/users/:id` | `GET` | User Service | Retrieve specific user by MongoDB ID | Path param `:id` |
| `/users/:id` | `PUT` | User Service | Update user profile | `{"department":"AI & Systems"}` |
| `/users/:id` | `DELETE` | User Service | Remove user record | Path param `:id` |
| `/products` | `POST` | Product Service | Add product to catalog | `{"name":"Book","price":49.99,"stock":20}` |
| `/products` | `GET` | Product Service | Retrieve catalog items | Query filters optional |
| `/products/:id` | `GET` | Product Service | Retrieve product details by ID | Path param `:id` |
| `/products/:id` | `PUT` | Product Service | Update product pricing / stock | `{"price":44.99,"stock":15}` |
| `/products/:id` | `DELETE` | Product Service | Remove product from catalog | Path param `:id` |
| `/orders` | `POST` | Order Service | Validate & orchestrate order creation | `{"userId":"...","productId":"...","quantity":2}` |
| `/orders` | `GET` | Order Service | List all orders with snapshots | None |
| `/orders/:id` | `GET` | Order Service | Retrieve order details by ID | Path param `:id` |
| `/orders/:id/status`| `PUT` | Order Service | Update order status | `{"status":"confirmed"}` |
| `/orders/:id` | `DELETE` | Order Service | Cancel / remove order record | Path param `:id` |

---

## 6. Step-by-Step Execution & Verification Guide

### Step 1: Start the Entire Multi-Service Stack

Run the following command from the project root:

```bash
docker compose up -d --build
```

Verify that all 5 containers are running and healthy:
```bash
docker compose ps
```

*Expected output:* Only `api-gateway` has port `0.0.0.0:3000->3000/tcp` published to host. `user-service`, `product-service`, `order-service`, and `campus-mongodb` have ports exposed only to the internal network.

---

### Step 2: Verify Gateway Health Check

```bash
curl -X GET http://localhost:3000/health
```

*Expected JSON response:*
```json
{
  "service": "api-gateway",
  "status": "healthy",
  "timestamp": "2026-09-29T05:08:12.345Z",
  "uptime": "25s",
  "version": "1.0.0",
  "gatewayPort": 3000,
  "serviceRegistry": {
    "userService": "http://user-service:3001",
    "productService": "http://product-service:3002",
    "orderService": "http://order-service:3003"
  }
}
```

---

### Step 3: Run End-to-End Tests via API Gateway

#### 1. Create a User (Routed to User Service)
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Garv Modi","email":"garv.modi@university.edu","role":"student","department":"Computer Science"}'
```

#### 2. Create a Product (Routed to Product Service)
```bash
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Distributed Cloud Systems Guide","price":59.99,"stock":40,"category":"textbooks","sku":"CS-CLOUD-701"}'
```

#### 3. Place an Order (Routed to Order Service -> Inter-service validation)
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"<USER_ID>","productId":"<PRODUCT_ID>","quantity":1,"shippingAddress":{"street":"400 Tech Ave","city":"San Jose","state":"CA","zipCode":"95112"}}'
```

---

### Step 4: Verify Centralized 502/503 Fault Handling (Unreachable Service Test)

To prove that the API Gateway traps downstream failures gracefully:

1. Stop the `user-service` container:
   ```bash
   docker stop user-service
   ```
2. Send a request to the user route via the gateway:
   ```bash
   curl -i -X GET http://localhost:3000/users
   ```
3. *Expected Result:* The gateway returns HTTP status `503 Service Unavailable` or `502 Bad Gateway` with a clear diagnostic JSON payload without crashing:
   ```json
   {
     "gateway": "CampusConnect-API-Gateway",
     "status": 503,
     "error": "Service Unavailable",
     "message": "Target service 'User Service' is currently unreachable or unresponsive.",
     "targetService": "User Service",
     "targetUrl": "http://user-service:3001",
     "attemptedPath": "/users",
     "method": "GET",
     "details": "ECONNREFUSED",
     "timestamp": "2026-09-29T05:10:00.000Z"
   }
   ```
4. Restart the `user-service`:
   ```bash
   docker start user-service
   ```

---

### Step 5: Postman Automated Testing

Import [`Microservices_Lab_7.postman_collection.json`](file:///Microservices_Lab_7.postman_collection.json) into Postman:
1. The collection variable `baseUrl` is set to `http://localhost:3000` (or your cloud gateway domain).
2. Execute the test collection in order:
   - `Gateway Health Check`
   - `Create User (Student)` -> Automatically populates `userId`
   - `Create Product (Textbook)` -> Automatically populates `productId`
   - `Create Order (Valid Flow)` -> Executes full cross-service transaction
   - `Unreachable Service Simulation` -> Confirms 502/503 error handling.

---

## 7. Written Reflection (Lab 6 vs. Lab 7)

> **Architectural & Operational Impact Reflection:**  
> Transitioning from Lab 6 to Lab 7 transformed our application from a loosely coupled set of exposed microservices into a cohesive, production-grade distributed system. In Lab 6, clients maintained direct dependencies on internal service hostnames and individual port assignments, which exposed private network topologies and complicated client-side error handling. Introducing the API Gateway established a single public entry point that encapsulates backend services behind a secure network boundary, enforces unified request logging, and handles downstream downtime with clean HTTP 502/503 responses. Furthermore, externalizing service locations into a configuration-driven service registry enabled frictionless routing updates and cloud deployment across diverse hosting environments without touching application source code.

---

## 8. Final Checklist

| Requirement Area | Item | Status | Verification Detail |
| :--- | :--- | :---: | :--- |
| **API Gateway** | `api-gateway` service created | ✅ | Node.js / Express / `http-proxy-middleware` |
| **API Gateway** | Routes to User, Product & Order | ✅ | Proxied to `/users`, `/products`, `/orders` |
| **API Gateway** | `GET /health` implemented | ✅ | Returns uptime, version, and active service registry |
| **API Gateway** | Request logging added | ✅ | Gateway console logs method, path, target, status & duration |
| **API Gateway** | 502/503 on unreachable service | ✅ | Returns structured JSON error on target socket error |
| **Service Discovery** | Service URLs in env vars/config | ✅ | Externalized into `serviceRegistry.js` & `.env` |
| **Service Discovery** | No hard-coded URLs in route code | ✅ | Routes dynamically bind to registry configuration |
| **Service Discovery** | Static vs dynamic discussed | ✅ | Comparative analysis provided in README Section 3 |
| **Cloud Deployment** | Cloud platform instructions | ✅ | Multi-cloud deployment guide + MongoDB Atlas config |
| **Evidence** | Postman Collection | ✅ | [`Microservices_Lab_7.postman_collection.json`](file:///Microservices_Lab_7.postman_collection.json) |
