import type { KnownAppAliasEntry } from '../types'

const POSTGRES_PUBLISHER = ['postgresql'] as const

export const DATABASES: readonly KnownAppAliasEntry[] = [
	{
		id: 'postgresql',
		match: {
			anyOf: [
				{ executable: ['postgres.exe', 'pg_ctl.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['postgresql'] },
						{ publisherContains: POSTGRES_PUBLISHER },
					],
				},
				{
					allOf: [
						{ productName: ['postgresql'] },
						{ publisherContains: POSTGRES_PUBLISHER },
					],
				},
			],
			exclude: [
				{ executable: ['psql.exe', 'pg_dump.exe', 'pg_restore.exe'] },
				{
					originalFilename: [
						'psql.exe',
						'setup.exe',
						'pg_dump.exe',
						'pg_restore.exe',
					],
				},
				{
					nameStartsWith: [
						'postgresql documentation',
						'postgresql release notes',
						'stack builder',
						'pgadmin',
						'sql shell',
					],
				},
			],
		},
		aliases: [
			['postgres', 'strong'],
			['postgresql', 'strong'],
			['pgsql', 'normal'],
		],
	},
	{
		id: 'psql',
		match: {
			anyOf: [
				{ executable: ['psql.exe'] },
				{
					allOf: [
						{ name: ['sql shell (psql)', 'sql shell'] },
						{ originalFilename: ['psql.exe'] },
					],
				},
				{ name: ['sql shell (psql)', 'sql shell'] },
			],
		},
		aliases: [
			['psql', 'strong'],
			['sql shell', 'strong'],
		],
	},
	{
		id: 'mysql-server',
		match: {
			anyOf: [
				{ executable: ['mysqld.exe', 'mysql.exe'] },
				{
					allOf: [
						{
							nameStartsWith: [
								'mysql server',
								'mysql 8',
								'mysql 5',
							],
						},
						{ publisherContains: ['oracle', 'mysql'] },
					],
				},
				{
					allOf: [
						{ productName: ['mysql server'] },
						{ publisherContains: ['oracle', 'mysql'] },
					],
				},
			],
			exclude: [
				{ executable: ['mysqlworkbench.exe'] },
				{
					nameStartsWith: [
						'mysql workbench',
						'mysql shell',
						'mysql router',
					],
				},
			],
		},
		aliases: [['mysql', 'strong']],
	},
	{
		id: 'mysql-workbench',
		match: {
			anyOf: [
				{ executable: ['mysqlworkbench.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['mysql workbench'] },
						{ originalFilename: ['mysqlworkbench.exe'] },
					],
				},
				{
					allOf: [
						{ nameStartsWith: ['mysql workbench'] },
						{ publisherContains: ['oracle', 'mysql'] },
					],
				},
				{ name: ['mysql workbench'] },
			],
		},
		aliases: [
			['mysql workbench', 'strong'],
			['mysql', 'normal'],
		],
	},
	{
		id: 'ssms',
		match: {
			anyOf: [
				{ executable: ['ssms.exe'] },
				{
					allOf: [
						{
							nameStartsWith: [
								'sql server management studio',
								'microsoft sql server management studio',
							],
						},
						{ originalFilename: ['ssms.exe'] },
					],
				},
				{
					allOf: [
						{
							nameStartsWith: [
								'sql server management studio',
								'microsoft sql server management studio',
							],
						},
						{ publisherContains: ['microsoft'] },
					],
				},
				{
					name: [
						'sql server management studio',
						'microsoft sql server management studio',
					],
				},
			],
		},
		aliases: [
			['ssms', 'strong'],
			['sql server management studio', 'strong'],
		],
	},
	{
		id: 'dbeaver',
		match: {
			anyOf: [
				{ executable: ['dbeaver.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['dbeaver'] },
						{ originalFilename: ['dbeaver.exe'] },
					],
				},
				{ name: ['dbeaver', 'dbeaver community'] },
			],
		},
		aliases: [['dbeaver', 'strong']],
	},
	{
		id: 'pgadmin',
		match: {
			anyOf: [
				{ executable: ['pgadmin4.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['pgadmin'] },
						{ originalFilename: ['pgadmin4.exe'] },
					],
				},
				{
					allOf: [
						{ productNameStartsWith: ['pgadmin'] },
						{ publisherContains: ['pgadmin', 'postgresql'] },
					],
				},
				{ name: ['pgadmin 4', 'pgadmin'] },
			],
		},
		aliases: [
			['pgadmin', 'strong'],
			['pg admin', 'strong'],
		],
	},
	{
		id: 'mongodb-compass',
		match: {
			anyOf: [
				{ executable: ['mongodbcompass.exe'] },
				{
					allOf: [
						{ productName: ['mongodbcompass', 'mongodb compass'] },
						{ publisherContains: ['mongodb'] },
					],
				},
				{ name: ['mongodb compass'] },
				{ productName: ['mongodbcompass'] },
			],
		},
		aliases: [
			['compass', 'normal'],
			['mongo', 'strong'],
			['mongodb', 'strong'],
		],
	},
	{
		id: 'tableplus',
		match: {
			anyOf: [{ executable: ['tableplus.exe'] }, { name: ['tableplus'] }],
		},
		aliases: [
			['tableplus', 'strong'],
			['table plus', 'normal'],
		],
	},
	{
		id: 'redis-insight',
		match: {
			anyOf: [
				{ executable: ['redis insight.exe', 'redisinsight.exe'] },
				{
					allOf: [
						{ nameStartsWith: ['redis insight', 'redisinsight'] },
						{
							originalFilename: [
								'redis insight.exe',
								'redisinsight.exe',
							],
						},
					],
				},
				{ name: ['redis insight', 'redisinsight'] },
			],
		},
		aliases: [['redis', 'strong']],
	},
]
