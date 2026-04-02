#!/bin/bash
# ============================================
# SSH Login - Acesso ao sistema sem senha
# ============================================
# Uso: ./ssh-login.sh [usuario] [servidor] [chave]
#
# Exemplos:
#   ./ssh-login.sh
#   ./ssh-login.sh ezequiel
#   ./ssh-login.sh ezequiel http://10.8.200.14:4000
#   ./ssh-login.sh ezequiel http://10.8.200.14:4000 ~/.ssh/id_ed25519

# Configurações padrão (edite aqui)
DEFAULT_USER="ezequiel"
DEFAULT_SERVER="http://10.8.200.14:4000"
DEFAULT_KEY="$HOME/.ssh/id_ed25519"

# Parâmetros
USER="${1:-$DEFAULT_USER}"
SERVER="${2:-$DEFAULT_SERVER}"
KEY="${3:-$DEFAULT_KEY}"

echo "========================================"
echo "  SSH Login - Sistema"
echo "========================================"
echo "  Usuário:  $USER"
echo "  Servidor: $SERVER"
echo "  Chave:    $KEY"
echo "========================================"
echo ""

# Verificar se a chave existe
if [ ! -f "$KEY" ]; then
  echo "ERRO: Chave SSH não encontrada em: $KEY"
  echo ""
  echo "Para gerar uma chave:"
  echo "  ssh-keygen -t ed25519 -C \"$USER\""
  echo ""
  echo "Depois registre a chave pública no painel admin:"
  echo "  cat ${KEY}.pub"
  exit 1
fi

# Verificar se curl está instalado
if ! command -v curl &>/dev/null; then
  echo "ERRO: curl não está instalado"
  exit 1
fi

# Verificar se ssh-keygen está instalado
if ! command -v ssh-keygen &>/dev/null; then
  echo "ERRO: ssh-keygen não está instalado"
  exit 1
fi

# Step 1: Solicitar challenge
echo "[1/3] Solicitando challenge ao servidor..."
RESPONSE=$(curl -s -X POST "$SERVER/api/auth/ssh/challenge" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\"}")

# Extrair challenge do JSON
CHALLENGE=$(echo "$RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin)['challenge'])" 2>/dev/null)

if [ -z "$CHALLENGE" ]; then
  echo "ERRO: Falha ao obter challenge"
  echo "Resposta: $RESPONSE"
  echo ""
  echo "Possíveis causas:"
  echo "  - Servidor offline"
  echo "  - Usuário não existe"
  echo "  - Nenhuma chave SSH registrada no painel"
  exit 1
fi

echo "      Challenge recebido: ${CHALLENGE:0:16}..."

# Step 2: Assinar o challenge
echo "[2/3] Assinando challenge com chave SSH..."
SIGNATURE=$(echo -n "$CHALLENGE" | ssh-keygen -Y sign -f "$KEY" -n challenge 2>/dev/null | base64 -w0)

if [ -z "$SIGNATURE" ]; then
  echo "ERRO: Falha ao assinar o challenge"
  echo "Verifique se a chave é válida: $KEY"
  exit 1
fi

echo "      Assinatura gerada com sucesso"

# Step 3: Verificar e obter token
echo "[3/3] Verificando assinatura e obtendo token..."
LOGIN_RESPONSE=$(curl -s -X POST "$SERVER/api/auth/ssh/verify" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\",\"challenge\":\"$CHALLENGE\",\"signature\":\"$SIGNATURE\"}")

# Extrair token
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "ERRO: Falha na autenticação"
  echo "Resposta: $LOGIN_RESPONSE"
  echo ""
  echo "Possíveis causas:"
  echo "  - Chave pública não registrada no painel"
  echo "  - Chave diferente da registrada"
  exit 1
fi

# Extrair info do usuário
DISPLAY_NAME=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin)['user']['displayName'])" 2>/dev/null)
ROLE=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin)['user']['role'])" 2>/dev/null)

echo ""
echo "========================================"
echo "  Login realizado com sucesso!"
echo "  Bem-vindo, $DISPLAY_NAME ($ROLE)"
echo "========================================"
echo ""

# Montar URL com token para abrir no browser
LOGIN_URL="$SERVER/auth-token?token=$TOKEN"

echo "Abrindo navegador..."
echo ""

# Tentar abrir no browser (compatível com WSL, Linux, Mac)
if command -v wslview &>/dev/null; then
  wslview "$LOGIN_URL"
elif command -v xdg-open &>/dev/null; then
  xdg-open "$LOGIN_URL"
elif command -v open &>/dev/null; then
  open "$LOGIN_URL"
elif command -v cmd.exe &>/dev/null; then
  cmd.exe /c start "" "$LOGIN_URL" 2>/dev/null
else
  echo "Não foi possível abrir o navegador automaticamente."
  echo ""
  echo "Abra este link manualmente:"
  echo "$LOGIN_URL"
fi

echo ""
echo "Ou use o token diretamente:"
echo "  curl -H \"Authorization: Bearer $TOKEN\" $SERVER/api/auth/profile"
