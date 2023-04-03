import inquirer from 'inquirer'
import fetch from 'node-fetch'
import * as fs from 'fs/promises'
import { homedir } from 'os'
import { inspect } from 'util'
import { spawn } from 'child_process'

const systemMessage = `
あなたはWindows、Linux、Mac OSのコマンドをよく知っている神です。ユーザーの要求を満たすコマンドを出力してください。ただし、関係ない要求は拒否してください。
また、返答は以下のテンプレートに沿ってください。

**CMD**
\`\`\`
{コマンド}
\`\`\`

**DESC**
{コマンド、引数の説明をなるべく複数行で}
`

const input = process.argv.slice(2).join(' ')

const ANSI = {
	Reset: "\x1b[0m",
	Bright: "\x1b[1m",

	FgRed: "\x1b[31m",
	FgGreen: "\x1b[32m",
	FgYellow: "\x1b[33m",
  FgWhite: "\x1b[37m",

  BgGreen: "\x1b[42m",
  BgBlue: "\x1b[44m",
  BgCyan: "\x1b[46m",
}

const clearAndPrint = (content) => {
  for (let i = process.stdout.getWindowSize()[1]; i > 0; i--) {
    console.log('\r\n')
  }
  console.log(content)
}

const talk = [
  {
    role: 'system',
    content: systemMessage,
  },
  {
    role: 'user',
    content: input
  },
]

const print = (command, description) => {
  const query = talk.filter(e => e.role === 'user').map(e => e.content)
  let input = ''
  for (let i = 0; i < query.length; i++) {
    input += `${ANSI.FgWhite}${i + 1}) ${ANSI.FgYellow}${query[i]}\n      `
  }
  clearAndPrint(`
    ${ANSI.FgWhite}========== ${ANSI.BgCyan}${ANSI.Bright} 入力 ${ANSI.Reset}${ANSI.FgWhite} ==========${ANSI.Reset}
      ${input.trim()}

    ${ANSI.FgWhite}========== ${ANSI.BgGreen}${ANSI.Bright} コマンド ${ANSI.Reset}${ANSI.FgWhite} ==========${ANSI.Reset}
      ${ANSI.FgWhite}> ${ANSI.FgYellow}${command.replace(/\n/g, '\n      ')}${ANSI.Reset}

    ${ANSI.FgWhite}========== ${ANSI.BgBlue}${ANSI.Bright} 説明 ${ANSI.Reset}${ANSI.FgWhite} ==========${ANSI.Reset}
      ${ANSI.FgWhite}${description.replace(/\n/g, '\n      ')}${ANSI.Reset}
`)
}

const credsFile = homedir() + '/.homemade-copilot-for-cli'

const ask = async () => {
  let apiKey = await fs.readFile(credsFile).then(buf => buf.toString('utf-8')).catch(() => null)
  if (!apiKey || apiKey === '') {
    const { apiKey: input } =
      await inquirer
        .prompt([
          {
            name: 'apiKey',
            message: 'OpenAI API Key',
            type: 'password',
          }
        ])
        .catch(err => {
          if (err.isTtyError) {
            console.error('Could not prompt for OpenAI API Key')
          } else {
            console.error(err.stack || err)
          }
          process.exit(1)
        })
    apiKey = input
  }
  print('取得中...', '取得中...')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      max_tokens: 2000,
      temperature: 1.0,
      messages: talk,
    }),
  }).then(res => res.json())
  if (!res.choices) {
    print('', `${ANSI.FgRed}データの取得に失敗しました: ${ANSI.Reset}${inspect(res, undefined, undefined, true)}`)
    await fs.rm(credsFile).catch(() => {})
    process.exit(2)
  }
  await fs.writeFile(credsFile, apiKey)
  const response = res.choices[0].message.content
  const regex = /[^]*(?:\*\*)?CMD(?:\*\*)?\n\`\`\`\n([^]*)\n\`\`\`\n\n(?:\*\*)?DESC(?:\*\*)?\n([^]*)/
  if (!regex.test(response)) {
    print('', `${ANSI.FgRed}無効な返答が返されました: ${ANSI.Reset}${response}`) 
    console.log()
    const action =
      await inquirer
        .prompt([
          {
            type: 'list',
            name: 'action',
            message: 'アクションを選択',
            choices: [
              { name: '📝 入力しなおす', value: 'retry' },
              { name: '❌ キャンセル', value: 'cancel' },
            ],
          },
          {
            type: 'input',
            name: 'input',
            message: '入力を追加',
            when: ({ action }) => action === 'retry',
          },
        ])
        .catch(e => {
          console.error(e.stack || e)
          process.exit(1)
        })
    if (action.action === 'retry') {
      talk.splice(-1, 1) // remove last user message
      talk.push({ role: 'user', content: action.input })
      ask()
    } else {
      process.exit(0)
    }
    return
  } else {
    const array = regex.exec(response)
    talk.push({ role: 'assistant', content: response })
    const askAction = async () => {
      print(array[1], array[2])
      console.log()
      const action =
        await inquirer
          .prompt([
            {
              type: 'list',
              name: 'action',
              message: 'アクションを選択',
              choices: [
                { name: '✨ このコマンドを実行する', value: 'execute' },
                { name: '📝 入力を追加する', value: 'revise' },
                { name: '❌ キャンセル', value: 'cancel' },
              ],
            },
            {
              type: 'confirm',
              name: 'confirmExecute',
              message: '本当に実行しますか？',
              when: ({ action }) => action === 'execute',
            },
            {
              type: 'input',
              name: 'input',
              message: '入力を追加',
              when: ({ action }) => action === 'revise',
            },
          ])
          .catch(e => {
            console.error(e.stack || e)
            process.exit(1)
          })
      // console.log(action)
      if (action.action === 'execute') {
        if (action.confirmExecute) {
          const proc = spawn(array[1], { shell: true, cwd: process.cwd() })
          proc.stdout.on('data', (data) => process.stdout.write(data))
          proc.stderr.on('data', (data) => process.stderr.write(data))
        } else {
          askAction()
        }
      } else if (action.action === 'revise') {
        talk.push({ role: 'user', content: action.input })
        ask()
      } else if (action.action === 'cancel') {
        process.exit(0)
      }
    }
    askAction()
  }
}

ask()
