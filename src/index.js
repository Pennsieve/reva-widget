let config = {
  sparcApi: 'http://localhost:8000'// 'https://sparc-api.herokuapp.com',
}

export const configure = (options) => {
  config = { ...config, ...options }
}

export const useConfig = () => {
  return config
}

import RevaWidget from './components/Widget.vue'

export { RevaWidget }
