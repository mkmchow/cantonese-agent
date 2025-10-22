# 🚀 Deployment Guide - Fly.io (Hong Kong)

Complete guide to deploy 喂喂機 to Fly.io with Hong Kong servers.

---

## 📋 Prerequisites

1. **Fly.io Account**
   - Sign up at https://fly.io
   - Free tier: 3 VMs, 160GB bandwidth/month

2. **Fly.io CLI**
   ```bash
   # macOS/Linux
   curl -L https://fly.io/install.sh | sh
   
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   ```

3. **API Keys Ready**
   - Google Cloud credentials JSON
   - AWS Access Key ID & Secret
   - OpenRouter API key

---

## 🎯 Step-by-Step Deployment

### **Step 1: Login to Fly.io**

```bash
fly auth login
```

This opens your browser for authentication.

---

### **Step 2: Launch App**

```bash
fly launch
```

**Interactive prompts:**
```
? Choose an app name: weiweiji (or leave blank for auto-generated)
? Choose a region: Hong Kong, Hong Kong (hkg)  ← SELECT THIS!
? Would you like to set up a Postgresql database? No
? Would you like to set up an Upstash Redis database? No
? Would you like to deploy now? No  ← Say NO (we need to set secrets first)
```

This creates `fly.toml` configuration file.

---

### **Step 3: Set Secrets (Environment Variables)**

```bash
# Google Cloud Speech-to-Text
fly secrets set GOOGLE_PROJECT_ID=your-gcp-project-id

# AWS Polly
fly secrets set AWS_ACCESS_KEY_ID=your-aws-access-key
fly secrets set AWS_SECRET_ACCESS_KEY=your-aws-secret-key
fly secrets set AWS_REGION=ap-east-1

# OpenRouter
fly secrets set OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
fly secrets set OPENROUTER_MODEL=openai/gpt-4o-mini
fly secrets set YOUR_SITE_URL=https://weiweiji.fly.dev
```

---

### **Step 4: Set Google Credentials from JSON File**

```bash
# This reads google-credentials.json and sets as secret
cat google-credentials.json | fly secrets set GOOGLE_CREDENTIALS_JSON=-
```

**Windows (PowerShell):**
```powershell
Get-Content google-credentials.json | fly secrets set GOOGLE_CREDENTIALS_JSON=-
```

---

### **Step 5: Deploy!**

```bash
fly deploy
```

This will:
1. Build Docker image
2. Push to Fly.io registry
3. Deploy to Hong Kong region
4. Run health checks
5. Start serving traffic

**Deployment takes ~2-3 minutes.**

---

### **Step 6: Open Your App**

```bash
fly open
```

Your app is now live at:
```
https://weiweiji.fly.dev
```

(Or whatever app name you chose)

---

## 🔍 Verify Deployment

### Check app status
```bash
fly status
```

### View logs
```bash
fly logs
```

### Check regions
```bash
fly regions list
```

Should show:
```
hkg (primary)
```

---

## 🎛️ Manage Your App

### Scale instances
```bash
# Scale to 2 instances (for redundancy)
fly scale count 2

# Scale memory
fly scale memory 1024  # 1GB RAM
```

### View secrets
```bash
fly secrets list
```

### Update a secret
```bash
fly secrets set OPENROUTER_API_KEY=new-key
```

### SSH into container (debugging)
```bash
fly ssh console
```

### Restart app
```bash
fly apps restart weiweiji
```

---

## 💰 Cost Estimate

**Fly.io Pricing (Hong Kong region):**
- Shared CPU, 256MB RAM: $1.94/month
- Shared CPU, 512MB RAM: $3.50/month
- Bandwidth: First 160GB free, then $0.02/GB

**For this app (light usage):**
- 1 instance (512MB): $3.50/month
- Typical bandwidth: < 20GB/month (free)
- **Total: ~$3.50/month**

**Plus API costs:**
- Google STT: ~$2/month (100 conversations)
- AWS Polly: ~$1/month
- OpenRouter: ~$2/month

**Grand total: ~$8-10/month**

---

## 🔒 Custom Domain (Optional)

### Add custom domain
```bash
fly certs add yourdomain.com
```

Then add DNS records (Fly.io will show you what to add).

---

## 🐛 Troubleshooting

### App won't start
```bash
# Check logs for errors
fly logs

# Common issues:
# 1. Missing secrets → fly secrets list
# 2. Port mismatch → Check PORT in fly.toml
# 3. Health check failing → Check /health endpoint
```

### STT not working
```bash
# Verify Google credentials
fly ssh console
echo $GOOGLE_CREDENTIALS_JSON | head -c 100

# Should show: {"type":"service_account"...
```

### High latency
```bash
# Verify region is HK
fly regions list

# Should show: hkg (primary)
```

### Out of memory
```bash
# Scale up memory
fly scale memory 1024
```

---

## 🔄 Update Deployed App

After making code changes:

```bash
git add .
git commit -m "Update feature X"
git push origin main

# Then deploy
fly deploy
```

**Zero-downtime deployment** - new version deployed, old version removed only after health checks pass!

---

## 📊 Monitoring

### View metrics
```bash
fly dashboard
```

Opens web dashboard showing:
- CPU/Memory usage
- Request counts
- Response times
- Error rates

### Set up alerts (optional)
Go to https://fly.io/dashboard → Your App → Monitoring

---

## 🗑️ Delete App (if needed)

```bash
fly apps destroy weiweiji
```

⚠️ **Warning:** This is permanent!

---

## 🎉 Success Checklist

- [ ] App deployed successfully
- [ ] Opened at https://weiweiji.fly.dev
- [ ] Status shows "running" (`fly status`)
- [ ] Health check passing
- [ ] Can connect from browser
- [ ] Microphone works
- [ ] Speech recognition works
- [ ] AI responds with audio
- [ ] Interruption works
- [ ] Accessible from phone

---

## 🆘 Need Help?

**Fly.io Community:**
- Forum: https://community.fly.io
- Discord: https://fly.io/discord

**This Project:**
- GitHub Issues: https://github.com/mkmchow/cantonese-agent/issues

---

**Deployment complete! Your Cantonese AI is now live in Hong Kong!** 🇭🇰🎉


