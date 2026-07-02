import { existsSync } from 'node:fs'
import process from 'node:process'

export function loadLocalEnv() {
  if (existsSync('.env')) {
    process.loadEnvFile('.env')
  }
}
