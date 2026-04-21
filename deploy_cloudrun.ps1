# Google Cloud Run Deployment Script (Professional Version)
$PROJECT_ID = gcloud config get-value project
if (-not $PROJECT_ID) {
    Write-Error "GCP Project ID not found. Please run 'gcloud config set project [YOUR_PROJECT_ID]'"
    exit
}

$REGION = "asia-southeast1" 
$SERVICE_NAME = "agritwin-app"

Write-Host "--- 1. Enabling Essential GCP APIs ---" -ForegroundColor Cyan
gcloud services enable run.googleapis.com `
                       aiplatform.googleapis.com `
                       iam.googleapis.com `
                       cloudbuild.googleapis.com `
                       artifactregistry.googleapis.com

# Optimize upload by creating .gcloudignore if missing
if (-not (Test-Path ".gcloudignore")) {
    Write-Host "Creating .gcloudignore to speed up build upload..." -ForegroundColor Gray
    @'
.git
.venv
node_modules
**/node_modules
**/__pycache__
dist
build
*.docx
'@ | Out-File -FilePath ".gcloudignore" -Encoding utf8
}

Write-Host "--- 2. Setting up Service Account Permissions (Vertex AI) ---" -ForegroundColor Cyan
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
$COMPUTE_SVC_ACCT = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

Write-Host "Assigning Vertex AI User role to $COMPUTE_SVC_ACCT..." -ForegroundColor Gray
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$COMPUTE_SVC_ACCT" `
    --role="roles/aiplatform.user" `
    --condition=None

Write-Host "--- 3. Preparing Environment Variables ---" -ForegroundColor Cyan
$FIREBASE_JSON_PATH = "backend/agritwin-mrv-firebase-adminsdk-fbsvc-cb08135bf7.json"
if (Test-Path $FIREBASE_JSON_PATH) {
    $JSON_CONTENT = Get-Content $FIREBASE_JSON_PATH -Raw
    # Indent JSON lines by 2 spaces for YAML block scalar compatibility
    $INDENTED_JSON = $JSON_CONTENT -split "`r?`n" | ForEach-Object { "  $_" } | Out-String
    Write-Host "Firebase credentials loaded and formatted." -ForegroundColor Green
} 

Write-Host "--- 4. Building and Pushing Image to GCR ---" -ForegroundColor Cyan
gcloud builds submit --config cloudbuild.yaml .

Write-Host "--- 5. Deploying to Cloud Run ---" -ForegroundColor Cyan
$ENV_FILE = "env.yaml"
$ENV_CONTENT = @"
FIREBASE_CREDENTIALS: |
$INDENTED_JSON
GCP_PROJECT_ID: "$PROJECT_ID"
GCP_LOCATION: "global"
FIREBASE_TARGET_UID: "ZLwjf4x1vBPkcEHc015OhelwwHo1"
"@
$ENV_CONTENT | Out-File -FilePath $ENV_FILE -Encoding utf8

gcloud run deploy $SERVICE_NAME `
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --env-vars-file $ENV_FILE

Remove-Item $ENV_FILE

$APP_URL = gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)'
Write-Host "`n==============================================" -ForegroundColor Yellow
Write-Host "App deployed successfully! Access it here: $APP_URL" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Yellow
