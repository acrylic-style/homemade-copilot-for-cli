# Homemade Copilot for CLI

Copilot for CLIをOpenAI社の`gpt-3.5-turbo`モデルで再現しようとしたもの

## Ubuntu環境でのインストール方法

```shell
git clone https://github.com/acrylic-style/homemade-copilot-for-cli
cd homemade-copilot-for-cli
yarn # or 'npm install'
echo "alias \"??=node $(pwd)/app.mjs\"" >> ~/.bashrc
```

## FAQ

### なんで？

Copilot for CLIのWaitlistが通らないから

### なんかバグった！

適当に作ったものなのであくまで参考程度に使ってください

### 実行したらOSが壊れた！

このアプリケーションの使用によって起きた事故等は自己責任です。
