import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

export const sourceExtension = /\.(?:[cm]?[jt]s|[jt]sx)$/
export const relativePath = (root, file) =>
	relative(root, file).replaceAll('\\', '/')

export function collectFiles(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const file = join(directory, entry.name)
		return entry.isDirectory() ? collectFiles(file) : [file]
	})
}

export function readCompilerOptions(root) {
	const configPath = join(root, 'tsconfig.app.json')
	const config = ts.readConfigFile(configPath, ts.sys.readFile)
	if (config.error)
		throw new Error(
			ts.flattenDiagnosticMessageText(config.error.messageText, '\n'),
		)
	const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
	const errors = parsed.errors.filter(error => error.code !== 18003)
	if (errors.length)
		throw new Error(
			errors
				.map(error =>
					ts.flattenDiagnosticMessageText(error.messageText, '\n'),
				)
				.join('\n'),
		)
	return parsed.options
}

function moduleSpecifier(node) {
	if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
		return node.moduleSpecifier
	if (
		ts.isImportEqualsDeclaration(node) &&
		ts.isExternalModuleReference(node.moduleReference)
	)
		return node.moduleReference.expression
	if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
		return node.argument.literal
	if (
		ts.isCallExpression(node) &&
		node.expression.kind === ts.SyntaxKind.ImportKeyword
	)
		return node.arguments[0]
	return undefined
}

export function readImports(file) {
	const source = ts.createSourceFile(
		file,
		readFileSync(file, 'utf8'),
		ts.ScriptTarget.Latest,
		true,
	)
	const imports = []
	function visit(node) {
		const specifier = moduleSpecifier(node)
		if (specifier && ts.isStringLiteralLike(specifier)) {
			const position = source.getLineAndCharacterOfPosition(
				specifier.getStart(source),
			)
			imports.push({
				specifier: specifier.text,
				line: position.line + 1,
				column: position.character + 1,
			})
		}
		ts.forEachChild(node, visit)
	}
	visit(source)
	return imports
}

export function resolveImport(specifier, file, options) {
	return ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule
		?.resolvedFileName
}
