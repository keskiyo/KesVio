import { register } from 'node:module'

// Lets the generator import the curated dictionary straight from src/ (extensionless relative
// imports, type-only syntax) under Node's built-in type stripping: the resolve hook tries `.ts`
// when a relative specifier has no extension.
register(new URL('./ts-resolver.mjs', import.meta.url))
