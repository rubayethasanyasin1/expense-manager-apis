# ==============================================================================
# Makefile for Expenser APIs Docker Operations
# ==============================================================================

.PHONY: help network-setup network-clean build up down restart logs shell clean prune dev dev-down prod prod-down migrate prod-migrate dev-migrate migrate-status studio check-env-dev check-env-prod check-docker check-docker-compose check-prerequisites-dev check-prerequisites-prod

# Default target
.DEFAULT_GOAL := help

# Network names
NETWORK_DEV := expense-manager-network-development
NETWORK_PROD := expense-manager-network-production

# Environment files
ENV_DEV := .env
ENV_PROD := .env.production
ENV_EXAMPLE := .env.example

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

## help: Display this help message
help:
	@echo "$(BLUE)Expenser APIs - Docker Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Development Commands:$(NC)"
	@echo "  make dev          - Start development environment with build"
	@echo "  make dev-build    - Build development Docker image"
	@echo "  make dev-rebuild  - Rebuild and restart development environment"
	@echo "  make dev-start    - Start development environment (no build)"
	@echo "  make dev-down     - Stop development environment"
	@echo "  make dev-restart  - Restart development environment"
	@echo "  make dev-logs     - View development logs"
	@echo "  make dev-shell    - Open shell in development API container"
	@echo "  make dev-ps       - List development containers"
	@echo ""
	@echo "$(GREEN)Production Commands:$(NC)"
	@echo "  make prod         - Build and start production environment"
	@echo "  make prod-build   - Build production images with cache"
	@echo "  make prod-down    - Stop production environment"
	@echo "  make prod-logs    - View production logs"
	@echo "  make prod-restart - Restart production services"
	@echo "  make prod-shell   - Open shell in production API container"
	@echo ""
	@echo "$(GREEN)Individual Service Management:$(NC)"
	@echo "  Restart Commands:"
	@echo "    make {env}-postgres-restart  - Restart postgres service"
	@echo "    make {env}-api-restart       - Restart API service"
	@echo ""
	@echo "  Start/Stop Commands:"
	@echo "    make {env}-postgres-start    - Start postgres service"
	@echo "    make {env}-postgres-stop     - Stop postgres service"
	@echo "    make {env}-api-start         - Start API service"
	@echo "    make {env}-api-stop          - Stop API service"
	@echo ""
	@echo "  Rebuild Commands:"
	@echo "    make {env}-postgres-rebuild  - Rebuild postgres service"
	@echo "    make {env}-api-rebuild       - Rebuild API service"
	@echo ""
	@echo "  Log Commands:"
	@echo "    make {env}-postgres-logs     - View postgres logs"
	@echo "    make {env}-api-logs          - View API logs"
	@echo ""
	@echo "  Note: {env} = dev or prod"
	@echo ""
	@echo "$(GREEN)Database Commands:$(NC)"
	@echo "  make dev-migrate      - Run Prisma migrations (development)"
	@echo "  make prod-migrate     - Run Prisma migrations (production)"
	@echo "  make migrate-status   - Check migration status"
	@echo "  make studio           - Open Prisma Studio"
	@echo ""
	@echo "$(GREEN)Environment Commands:$(NC)"
	@echo "  make check-env-dev            - Check development environment file"
	@echo "  make check-env-prod           - Check production environment file"
	@echo "  make check-docker             - Check if Docker is installed and running"
	@echo "  make check-docker-compose     - Check if Docker Compose is available"
	@echo "  make check-prerequisites-dev  - Check all development prerequisites"
	@echo "  make check-prerequisites-prod - Check all production prerequisites"
	@echo "  make setup-env                - Setup environment files from example"
	@echo ""
	@echo "$(GREEN)Management Commands:$(NC)"
	@echo "  make ps           - List running containers (all environments)"
	@echo "  make stats        - Show container resource usage"
	@echo "  make monitor      - Monitor container resources (live)"
	@echo "  make clean        - Remove all containers and volumes"
	@echo "  make prune        - Remove unused Docker resources"
	@echo ""

# ==============================================================================
# Network Setup
# ==============================================================================

## check-env-dev: Check if development environment file exists
check-env-dev:
	@if [ ! -f $(ENV_DEV) ]; then \
		echo "$(RED)❌ Error: $(ENV_DEV) not found!$(NC)"; \
		echo "$(YELLOW)Creating $(ENV_DEV) from $(ENV_EXAMPLE)...$(NC)"; \
		cp $(ENV_EXAMPLE) $(ENV_DEV); \
		echo "$(GREEN)✅ Created $(ENV_DEV)$(NC)"; \
		echo "$(YELLOW)⚠️  Please update the values in $(ENV_DEV) before starting!$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)✅ $(ENV_DEV) exists$(NC)"

## check-env-prod: Check if production environment file exists
check-env-prod:
	@if [ ! -f $(ENV_PROD) ]; then \
		echo "$(RED)❌ Error: $(ENV_PROD) not found!$(NC)"; \
		echo "$(YELLOW)⚠️  Production environment file is required!$(NC)"; \
		echo "$(YELLOW)Creating $(ENV_PROD) template...$(NC)"; \
		cp $(ENV_EXAMPLE) $(ENV_PROD); \
		echo "$(GREEN)✅ Created $(ENV_PROD) template$(NC)"; \
		echo "$(RED)⚠️  IMPORTANT: Update all values in $(ENV_PROD) with production settings!$(NC)"; \
		echo "$(RED)⚠️  Especially: POSTGRES_PASSWORD, JWT_SECRET, CORS_ORIGIN$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)✅ $(ENV_PROD) exists$(NC)"
	@if grep -q "CHANGE_THIS" $(ENV_PROD) || grep -q "your-super-secret" $(ENV_PROD); then \
		echo "$(RED)⚠️  WARNING: $(ENV_PROD) contains placeholder values!$(NC)"; \
		echo "$(RED)⚠️  Update all placeholder values before deploying to production!$(NC)"; \
	fi

## setup-env: Setup environment files from example
setup-env:
	@echo "$(GREEN)Setting up environment files...$(NC)"
	@if [ ! -f $(ENV_DEV) ]; then \
		cp $(ENV_EXAMPLE) $(ENV_DEV); \
		echo "$(GREEN)✅ Created $(ENV_DEV)$(NC)"; \
	else \
		echo "$(YELLOW)$(ENV_DEV) already exists$(NC)"; \
	fi
	@if [ ! -f $(ENV_PROD) ]; then \
		cp $(ENV_EXAMPLE) $(ENV_PROD); \
		echo "$(GREEN)✅ Created $(ENV_PROD) template$(NC)"; \
		echo "$(RED)⚠️  Remember to update $(ENV_PROD) with production values!$(NC)"; \
	else \
		echo "$(YELLOW)$(ENV_PROD) already exists$(NC)"; \
	fi

## check-docker: Check if Docker is installed and running
check-docker:
	@which docker >/dev/null 2>&1 || { echo "$(RED)❌ Error: Docker is not installed!$(NC)"; echo "$(YELLOW)Install Docker from: https://docs.docker.com/get-docker/$(NC)"; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "$(RED)❌ Error: Docker daemon is not running!$(NC)"; echo "$(YELLOW)Please start Docker Desktop or Docker daemon$(NC)"; exit 1; }
	@echo "$(GREEN)✅ Docker is installed and running$(NC)"

## check-docker-compose: Check if Docker Compose is available
check-docker-compose:
	@docker compose version >/dev/null 2>&1 || { echo "$(RED)❌ Error: Docker Compose is not available!$(NC)"; echo "$(YELLOW)Docker Compose is required (comes with Docker Desktop)$(NC)"; exit 1; }
	@echo "$(GREEN)✅ Docker Compose is available$(NC)"

## check-prerequisites-dev: Check all prerequisites for development
check-prerequisites-dev: check-docker check-docker-compose check-env-dev
	@echo "$(GREEN)✅ All development prerequisites are met!$(NC)"

## check-prerequisites-prod: Check all prerequisites for production
check-prerequisites-prod: check-docker check-docker-compose check-env-prod
	@echo "$(GREEN)✅ All production prerequisites are met!$(NC)"

## network-setup: Create Docker networks
network-setup:
	@echo "$(GREEN)Creating Docker networks...$(NC)"
	@docker network inspect $(NETWORK_DEV) >/dev/null 2>&1 || docker network create $(NETWORK_DEV)
	@docker network inspect $(NETWORK_PROD) >/dev/null 2>&1 || docker network create $(NETWORK_PROD)
	@echo "$(GREEN)✅ Networks created: $(NETWORK_DEV), $(NETWORK_PROD)$(NC)"

## network-clean: Remove Docker networks
network-clean:
	@echo "$(YELLOW)Removing Docker networks...$(NC)"
	@docker network rm $(NETWORK_DEV) 2>/dev/null || true
	@docker network rm $(NETWORK_PROD) 2>/dev/null || true
	@echo "$(GREEN)✅ Networks removed$(NC)"

# ==============================================================================
# Development Environment
# ==============================================================================

## dev: Start development environment
dev: check-prerequisites-dev
	@echo "$(GREEN)Starting development environment...$(NC)"
	docker compose -f docker-compose.development.yml up --build -d
	@echo "$(GREEN)✅ Development environment is running!$(NC)"
	@echo "$(BLUE)API: http://localhost:3000$(NC)"
	@echo "$(BLUE)Health: http://localhost:3000/api/v1/health$(NC)"

## dev-build: Build development Docker image
dev-build:
	@echo "$(GREEN)Building development Docker image...$(NC)"
	docker compose -f docker-compose.development.yml build --no-cache

## dev-rebuild: Rebuild and restart development environment
dev-rebuild: dev-down dev-build dev-start

## dev-start: Start development environment (without build)
dev-start:
	@echo "$(GREEN)Starting development environment...$(NC)"
	docker compose -f docker-compose.development.yml up -d

## dev-down: Stop development environment
dev-down:
	@echo "$(YELLOW)Stopping development environment...$(NC)"
	docker compose -f docker-compose.development.yml down --remove-orphans

## dev-restart: Restart development environment
dev-restart:
	@echo "$(YELLOW)Restarting development environment...$(NC)"
	docker compose -f docker-compose.development.yml restart

## dev-logs: View development logs
dev-logs:
	@echo "$(BLUE)Development logs:$(NC)"
	docker compose -f docker-compose.development.yml logs -f

## dev-shell: Open shell in development API container
dev-shell:
	@echo "$(BLUE)Opening shell in development API container...$(NC)"
	docker compose -f docker-compose.development.yml exec api sh

## dev-ps: List development containers
dev-ps:
	@echo "$(BLUE)Development containers:$(NC)"
	docker compose -f docker-compose.development.yml ps

## dev-postgres-restart: Restart development postgres only
dev-postgres-restart:
	@echo "$(YELLOW)Restarting development postgres...$(NC)"
	docker compose -f docker-compose.development.yml restart postgres
	@echo "$(GREEN)✅ Development postgres restarted!$(NC)"

## dev-api-restart: Restart development API only
dev-api-restart:
	@echo "$(YELLOW)Restarting development API...$(NC)"
	docker compose -f docker-compose.development.yml restart api
	@echo "$(GREEN)✅ Development API restarted!$(NC)"

## dev-postgres-logs: View development postgres logs
dev-postgres-logs:
	@echo "$(BLUE)Development postgres logs:$(NC)"
	docker compose -f docker-compose.development.yml logs -f postgres

## dev-api-logs: View development API logs
dev-api-logs:
	@echo "$(BLUE)Development API logs:$(NC)"
	docker compose -f docker-compose.development.yml logs -f api

## dev-postgres-stop: Stop development postgres only
dev-postgres-stop:
	@echo "$(YELLOW)Stopping development postgres...$(NC)"
	docker compose -f docker-compose.development.yml stop postgres
	@echo "$(GREEN)✅ Development postgres stopped!$(NC)"

## dev-api-stop: Stop development API only
dev-api-stop:
	@echo "$(YELLOW)Stopping development API...$(NC)"
	docker compose -f docker-compose.development.yml stop api
	@echo "$(GREEN)✅ Development API stopped!$(NC)"

## dev-postgres-start: Start development postgres only
dev-postgres-start:
	@echo "$(GREEN)Starting development postgres...$(NC)"
	docker compose -f docker-compose.development.yml up -d postgres
	@echo "$(GREEN)✅ Development postgres started!$(NC)"

## dev-api-start: Start development API only
dev-api-start:
	@echo "$(GREEN)Starting development API...$(NC)"
	docker compose -f docker-compose.development.yml up -d api
	@echo "$(GREEN)✅ Development API started!$(NC)"

## dev-postgres-rebuild: Rebuild development postgres
dev-postgres-rebuild:
	@echo "$(GREEN)Rebuilding development postgres...$(NC)"
	docker compose -f docker-compose.development.yml up -d --build --force-recreate postgres
	@echo "$(GREEN)✅ Development postgres rebuilt!$(NC)"

## dev-api-rebuild: Rebuild development API
dev-api-rebuild:
	@echo "$(GREEN)Rebuilding development API...$(NC)"
	docker compose -f docker-compose.development.yml up -d --build --force-recreate api
	@echo "$(GREEN)✅ Development API rebuilt!$(NC)"

# ==============================================================================
# Production Environment
# ==============================================================================

## prod: Build and start production environment
prod: check-prerequisites-prod
	@echo "$(GREEN)Building and starting production environment...$(NC)"
	docker compose -f docker-compose.production.yml up --build -d
	@echo "$(GREEN)✅ Production environment is running!$(NC)"
	@echo "$(BLUE)API: http://localhost:3000$(NC)"
	@echo "$(BLUE)Health: http://localhost:3000/api/v1/health$(NC)"

## prod-build: Build production images with cache
prod-build:
	@echo "$(GREEN)Building production images...$(NC)"
	DOCKER_BUILDKIT=1 docker compose -f docker-compose.production.yml build --parallel

## prod-down: Stop production environment
prod-down:
	@echo "$(YELLOW)Stopping production environment...$(NC)"
	docker compose -f docker-compose.production.yml down --remove-orphans

## prod-restart: Restart production services
prod-restart:
	@echo "$(YELLOW)Restarting production services...$(NC)"
	docker compose -f docker-compose.production.yml restart
	@echo "$(GREEN)✅ Production services restarted!$(NC)"

## prod-logs: View production logs
prod-logs:
	@echo "$(BLUE)Production logs:$(NC)"
	docker compose -f docker-compose.production.yml logs -f

## prod-shell: Open shell in production API container
prod-shell:
	@echo "$(BLUE)Opening shell in production API container...$(NC)"
	docker compose -f docker-compose.production.yml exec api sh

## prod-postgres-restart: Restart production postgres only
prod-postgres-restart:
	@echo "$(YELLOW)Restarting production postgres...$(NC)"
	docker compose -f docker-compose.production.yml restart postgres
	@echo "$(GREEN)✅ Production postgres restarted!$(NC)"

## prod-api-restart: Restart production API only
prod-api-restart:
	@echo "$(YELLOW)Restarting production API...$(NC)"
	docker compose -f docker-compose.production.yml restart api
	@echo "$(GREEN)✅ Production API restarted!$(NC)"

## prod-postgres-logs: View production postgres logs
prod-postgres-logs:
	@echo "$(BLUE)Production postgres logs:$(NC)"
	docker compose -f docker-compose.production.yml logs -f postgres

## prod-api-logs: View production API logs
prod-api-logs:
	@echo "$(BLUE)Production API logs:$(NC)"
	docker compose -f docker-compose.production.yml logs -f api

## prod-postgres-shell: Open shell in production postgres container
prod-postgres-shell:
	@echo "$(BLUE)Opening shell in production postgres container...$(NC)"
	docker compose -f docker-compose.production.yml exec postgres sh

## prod-db-shell: Open PostgreSQL CLI in production
prod-db-shell:
	@echo "$(BLUE)Opening PostgreSQL CLI in production...$(NC)"
	docker compose -f docker-compose.production.yml exec postgres psql -U ${POSTGRES_USER:-expenseuser} -d ${POSTGRES_DB:-expensedb}

## prod-postgres-stop: Stop production postgres only
prod-postgres-stop:
	@echo "$(YELLOW)Stopping production postgres...$(NC)"
	docker compose -f docker-compose.production.yml stop postgres
	@echo "$(GREEN)✅ Production postgres stopped!$(NC)"

## prod-api-stop: Stop production API only
prod-api-stop:
	@echo "$(YELLOW)Stopping production API...$(NC)"
	docker compose -f docker-compose.production.yml stop api
	@echo "$(GREEN)✅ Production API stopped!$(NC)"

## prod-postgres-start: Start production postgres only
prod-postgres-start:
	@echo "$(GREEN)Starting production postgres...$(NC)"
	docker compose -f docker-compose.production.yml up -d postgres
	@echo "$(GREEN)✅ Production postgres started!$(NC)"

## prod-api-start: Start production API only
prod-api-start:
	@echo "$(GREEN)Starting production API...$(NC)"
	docker compose -f docker-compose.production.yml up -d api
	@echo "$(GREEN)✅ Production API started!$(NC)"

## prod-postgres-rebuild: Rebuild production postgres
prod-postgres-rebuild:
	@echo "$(GREEN)Rebuilding production postgres...$(NC)"
	docker compose -f docker-compose.production.yml up -d --build --force-recreate postgres
	@echo "$(GREEN)✅ Production postgres rebuilt!$(NC)"

## prod-api-rebuild: Rebuild production API
prod-api-rebuild:
	@echo "$(GREEN)Rebuilding production API...$(NC)"
	docker compose -f docker-compose.production.yml up -d --build --force-recreate api
	@echo "$(GREEN)✅ Production API rebuilt!$(NC)"

# ==============================================================================
# Database Commands
# ==============================================================================

## dev-migrate: Run Prisma migrations (development)
dev-migrate:
	@echo "$(GREEN)Running Prisma migrations in development...$(NC)"
	docker compose -f docker-compose.development.yml exec api pnpm prisma:deploy
	@echo "$(GREEN)✅ Migrations completed$(NC)"

## prod-migrate: Run Prisma migrations (production)
prod-migrate:
	@echo "$(GREEN)Running Prisma migrations in production...$(NC)"
	docker compose -f docker-compose.production.yml exec api pnpm prisma:deploy
	@echo "$(GREEN)✅ Migrations completed$(NC)"

## migrate-status: Check migration status
migrate-status:
	@echo "$(BLUE)Checking migration status...$(NC)"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@docker compose -f docker-compose.development.yml exec api pnpm prisma migrate status || true
	@echo ""
	@echo "$(GREEN)Production:$(NC)"
	@docker compose -f docker-compose.production.yml exec api pnpm prisma migrate status || true

## studio: Open Prisma Studio
studio:
	@echo "$(BLUE)Opening Prisma Studio...$(NC)"
	@read -p "Which environment? (dev/prod): " env; \
	case $$env in \
		dev) docker compose -f docker-compose.development.yml exec api pnpm prisma:studio --port 5555 ;; \
		prod) docker compose -f docker-compose.production.yml exec api pnpm prisma:studio --port 5557 ;; \
		*) echo "$(RED)Invalid environment!$(NC)" ;; \
	esac

# ==============================================================================
# Management Commands
# ==============================================================================

## ps: List running containers
ps:
	@echo "$(BLUE)Running containers (all environments):$(NC)"
	@docker ps --filter "name=expense-manager-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

## stats: Show container resource usage
stats:
	@echo "$(BLUE)Container resource usage:$(NC)"
	docker stats --no-stream --filter "name=expense-manager-"

## monitor: Monitor container resources (live)
monitor:
	@echo "$(BLUE)Monitoring container resources (Ctrl+C to exit)...$(NC)"
	docker stats --filter "name=expense-manager-"

## inspect: Inspect container details
inspect:
	@read -p "Enter environment (dev/prod): " env; \
	read -p "Enter service name (postgres/api): " service; \
	case $$env in \
		dev) docker compose -f docker-compose.development.yml exec $$service sh -c "top -bn1 | head -20" ;; \
		prod) docker compose -f docker-compose.production.yml exec $$service sh -c "top -bn1 | head -20" ;; \
		*) echo "$(RED)Invalid environment!$(NC)" ;; \
	esac

## clean: Remove all containers and volumes
clean:
	@echo "$(RED)Removing all containers and volumes...$(NC)"
	@read -p "Are you sure? This will delete all data! (y/N): " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		docker compose -f docker-compose.production.yml down -v 2>/dev/null || true; \
		docker compose -f docker-compose.development.yml down -v 2>/dev/null || true; \
		echo "$(GREEN)✅ Cleanup complete!$(NC)"; \
	else \
		echo "$(YELLOW)Cleanup cancelled.$(NC)"; \
	fi

## prune: Remove unused Docker resources
prune:
	@echo "$(YELLOW)Removing unused Docker resources...$(NC)"
	docker system prune -af --volumes
	@echo "$(GREEN)✅ Prune complete!$(NC)"
