#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Aplicar cambios de usuarios requeridos, ejecutar pre-publicación, update/rebuild de contenedores y pruebas post-publicación"
backend:
	- task: "Pre-publicación backend crítica"
		implemented: true
		working: true
		file: "scripts/pre_publish_gate.ps1"
		stuck_count: 0
		priority: "high"
		needs_retesting: false
		status_history:
			- working: true
				agent: "main"
				comment: "2026-02-26: Ejecutada suite crítica backend (PIN/lockout/técnicos/importación), resultado OK."
			- working: false
				agent: "main"
				comment: "2026-03-03: Gate pre-publicación falló inicialmente por tests PIN con payload antiguo (faltaban last_name/phone/branch_id)."
			- working: true
				agent: "main"
				comment: "2026-03-03: Tests backend actualizados al nuevo contrato de usuarios PIN; pre_publish_gate.ps1 volvió a ejecutar en verde."
	- task: "Servicios backend tras rebuild"
		implemented: true
		working: true
		file: "backend/server.py"
		stuck_count: 0
		priority: "high"
		needs_retesting: false
		status_history:
			- working: true
				agent: "main"
				comment: "2026-02-26: docker compose up -d --build backend frontend completado; backend responde 200 en /api/."
			- working: true
				agent: "main"
				comment: "2026-03-03: publish_via_docker_desktop.ps1 ejecutado; contenedores backend/frontend/mongodb recreados y en estado Up."
	- task: "Contrato usuarios PIN requeridos"
		implemented: true
		working: true
		file: "backend/server.py"
		stuck_count: 0
		priority: "high"
		needs_retesting: false
		status_history:
			- working: true
				agent: "main"
				comment: "2026-03-03: Alta/edición de usuarios PIN alineada a campos requeridos (name, last_name, phone, login_pin, role, branch_id) y validada por API."

frontend:
	- task: "Build frontend producción"
		implemented: true
		working: true
		file: "frontend"
		stuck_count: 0
		priority: "high"
		needs_retesting: false
		status_history:
			- working: true
				agent: "main"
				comment: "2026-02-26: Build compilado correctamente durante pre-publish y rebuild de contenedor."
			- working: true
				agent: "main"
				comment: "2026-03-03: Build frontend validado nuevamente durante pre_publish_gate y publish_via_docker_desktop."
	- task: "Post-publicación extendida"
		implemented: true
		working: true
		file: "scripts/post_publish_extended_suite.ps1"
		stuck_count: 0
		priority: "high"
		needs_retesting: false
		status_history:
			- working: true
				agent: "main"
				comment: "2026-02-26: Suite extendida ejecutada, 6/6 tests passed (dos corridas consecutivas)."
			- working: false
				agent: "main"
				comment: "2026-03-03: Primera corrida post-publicación falló por specs E2E desactualizados tras nuevo payload requerido."
			- working: false
				agent: "main"
				comment: "2026-03-03: Segunda corrida llegó a 7 passed pero falló verificación branding TopCar por PIN desfasado."
			- working: true
				agent: "main"
				comment: "2026-03-03: Specs E2E y verificadores branding corregidos (incluye reset automático de PIN); suite post_publish_extended_suite.ps1 quedó OK con 7 passed + branding TopCar/Mundo OK."
	- task: "UI usuarios apellidos visibles"
		implemented: true
		working: true
		file: "frontend/src/pages/UsersAdminPage.jsx"
		stuck_count: 0
		priority: "medium"
		needs_retesting: false
		status_history:
			- working: true
				agent: "main"
				comment: "2026-03-03: Columna Apellidos agregada en tabla principal de usuarios PIN y tabla de PIN Kiosko; validación sin errores en archivo."

metadata:
	created_by: "main_agent"
	version: "1.0"
	test_sequence: 2
	run_ui: true

test_plan:
	current_focus:
		- "Monitorear estabilidad post-publicación tras endurecer contrato de usuarios PIN"
	stuck_tasks: []
	test_all: false
	test_priority: "high_first"

agent_communication:
	- agent: "main"
		message: "Resumen aplicado en test_result.md con evidencia de pre-publish OK, rebuild OK, health checks 200/200 y post-publish 6/6 PASS."
	- agent: "main"
		message: "2026-02-27: Índice de evidencia agregado para migración de rol typo progrmador->programador en test_reports/role_typo_migration_check_2026-02-27.txt (remaining_total=0)."
	- agent: "main"
		message: "2026-03-03: Ciclo completo ejecutado y estabilizado (pre-publish OK -> publish/rebuild OK -> post-publish OK). Se actualizaron tests backend/E2E al nuevo contrato de usuarios PIN requeridos y branding checks con auto-reset de PIN."