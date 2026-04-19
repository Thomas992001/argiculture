# Google Cloud Run Deployment Script (Unified App)
$PROJECT_ID = gcloud config get-value project
if (-not $PROJECT_ID) {
    Write-Error "GCP Project ID not found. Please run 'gcloud config set project [YOUR_PROJECT_ID]'"
    exit
}

$REGION = "asia-southeast1" 
$SERVICE_NAME = "agritwin-app"

Write-Host "--- Deploying Full-Stack Application ---" -ForegroundColor Cyan
gcloud builds submit --config cloudbuild.yaml .

Write-Host "--- Deploying to Cloud Run ---" -ForegroundColor Cyan
gcloud run deploy $SERVICE_NAME `
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated

$APP_URL = gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)'
Write-Host "==============================================" -ForegroundColor Yellow
Write-Host "App deployed successfully! Access it here: $APP_URL" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Yellow
