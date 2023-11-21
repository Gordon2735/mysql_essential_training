'use strict';

import { Request, Response, NextFunction } from '../../../app.js';
import express from 'express';
import getConfig from '../../../../config/config.js';
import createUserTable, {
	insertSession,
	insertUser,
	findUserByUsername
} from '../../../models/Schemas/userModel.js';
import bcrypt from 'bcryptjs';
import { connection } from '../../../models/databases/mysqlDB.js';
import { Connection } from 'mysql2/promise';
import Session from 'express-session';

declare module 'express-session' {
	interface Session {
		data: SessionData;
		views: number;
		session_id: Session & Partial<SessionData>;
	}
}

const config = await getConfig();
const app: express.Application = express();

declare module 'express-session' {
	interface Session {
		data: SessionData;
		views: number;
	}
}

async function indexHandler(req: Request, res: Response): Promise<void> {
	const index_script = `<script type="module" src="/src/ts/index.js" content="text/javascript"></script>`;
	try {
		res.set('Content-Type', 'text/html');
		res.set('target', '_blank');
		res.render('index', {
			title: `MySQL Sandbox`,
			layout: 'main',
			helpers: 'helpers',
			partials: 'footer_partial',
			script: [index_script],
			appName: config.applicationName,
			session: `${await sessionView()}`
		});

		console.info(`
				req.body.username: ${req.body.username}
				req.session: ${req.session}
				req.session.views: ${req.session.views}
			
			`);
		async function sessionView(): Promise<string> {
			if (!req.session.views) {
				req.session.views = 1;
				return `
					<strong>
						<p class="sessionParaFirst">
							First View: | ${req.session.views} |
						</p>
					</strong>
				`;
			} else {
				req.session.views++;
				return `
					<strong>
						<p class="sessionParaMas">
							Number of times you visited View: | ${req.session.views} |
						</p>
					</strong>

				`;
			}
		}

		return Promise.resolve() as Promise<void>;
	} catch (error: unknown) {
		console.error(`indexHandler had an ERROR: ${error}`);
		res.status(500).send('Server Error');

		return Promise.reject() as Promise<void>;
	}
}

async function registerHandler(_req: Request, res: Response): Promise<void> {
	try {
		const register_index = `<script type="module" src="/src/ts/register.js" content="text/javascript"></script>`;
		res.set('Content-Type', 'text/html');
		res.set('target', '_blank');
		res.render('register', {
			title: 'Register New User',
			layout: 'register_main',
			partials: 'partials',
			helpers: 'helpers',
			script: [register_index]
		});
		return Promise.resolve() as Promise<void>;
	} catch (error: unknown) {
		console.error(`registerHandler had an ERROR: ${error}`);
		res.status(500).send('Server Error');

		return Promise.reject() as Promise<void>;
	}
}

async function registerPostHandler(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	try {
		const errors: any = [];

		createUserTable();

		const { username, email, password, password2 }: any = req.body;
		await insertUser(username, email, password);

		if (username && email && password) {
			console.log(
				`${username}:  Thank You for registering! Please login`
			);
			res.redirect('/login');
		} else if (!username || !email || !password || !password2) {
			errors.push({ msg: 'Please fill in all fields' });
		} else if (password !== password2) {
			errors.push({ msg: 'Passwords do not match' });
		} else if (password.length < 8) {
			errors.push({ msg: 'Password must be at least 8 characters' });
		} else if (errors.length > 0) {
			res.render('register', {
				errors
			});
		} else {
			res.send('pass');
		}
		return Promise.resolve() as Promise<void>;
	} catch (error: unknown) {
		console.error(`registerPostHandler had an ERROR: ${error}`);
		res.status(500).send(`Post Register Error: ${error}`);

		return Promise.reject() as Promise<void>;
	}
}

async function loginHandler(req: Request, res: Response): Promise<void> {
	try {
		const login_index = `<script type="module" src="/src/ts/login_index.js" content="text/javascript"></script>`;
		res.set('Content-Type', 'text/html');
		res.set('target', '_blank');
		res.render('login', {
			title: 'User Login',
			layout: 'login_main',
			partials: 'partials',
			helpers: 'helpers',
			script: [login_index],
			username: req.body.username,
			email: req.body.email,
			sessionView: `${await sessionView()}`
		});

		app.use((req: Request, _res: Response, _next: NextFunction) => {
			return req.body;
		});

		async function sessionView(): Promise<string> {
			if (!req?.session.views) {
				req.session.views = 1;
				return `
						<p class="sessionParaFirst">
							First View: | ${req.session.views} |
						</p>
					`;
			} else {
				req.session.views++;
				return `
						<p class="sessionParaFirst">
							Number of times you visited View: | ${req.session.views} |
						</p>
					`;
			}
		}
		sessionView();

		return Promise.resolve()
			.then(() => {
				console.info(`loginHandler processed`);
			})
			.then(() => {
				if (req.body.username) {
					console.info(
						`
							%c
							username: ${req.body.username},
							email: ${req.body.email} 
						`,
						`
							color: chartreuse;
							font-family: 'Titillium Web', sans-serif; 
							font-size: 0.85rem;
							font-weight: bold;
							background-color: black;						
						`
					);
					return;
				}
			})
			.catch((error: unknown) => {
				console.error(
					`login Route Handler: LoginPopupHandler | Type of ERROR: ${error}`
				);
				res.status(500).send(`login handler Error: ${error}`);
				return Promise.reject() as Promise<void>;
			}) as Promise<void>;
	} catch (error: unknown) {
		console.error(`loginHandler had an ERROR: ${error}`);
		res.status(500).send('Server Error');

		return Promise.reject() as Promise<void>;
	}
}

async function loginPostHandler(req: Request, res: Response): Promise<void> {
	try {
		const { username, password }: any = req.body;
		const user: any = await findUserByUsername(username);

		app.use((_req: Request, res: Response, _next: NextFunction) => {
			res.locals.id = user.id;
			res.locals.username = user.username;
			res.locals.email = user.email;

			console.info(
				`id: ${user.id} || user: ${user.username} || email: ${user.email}`
			);

			// let session_id: string;
			return insertSession(
				req.session.session_id,
				user.username,
				config.session_key,
				user.id,
				req.session.data
			);
		});
		console.info(
			`id: ${user.id} || user: ${user.username} || email: ${user.email}`
		);

		if (!user) {
			res.status(400).send({ message: 'Invalid Credentials!' });

			return Promise.reject() as Promise<void>;
		}

		const isMatch: boolean = await bcrypt.compare(password, user.password);
		console.info(`isMatch: ${isMatch}`);

		req.body.username = user.username;
		req.body.email = user.email;
		res.locals.username = req.body.username;
		res.locals.email = req.body.email;

		if (isMatch === true) {
			console.info(
				`
				%c
				req.body.username: ${req.body.username},
				req.body.email: ${req.body.email},
				res.locals.username: ${res.locals.username} 
				res.locals.email: ${res.locals.email} 
			`,
				`
				color: chartreuse;
				font-family: 'Titillium Web', sans-serif; 
				font-size: 0.85rem;
				font-weight: bold;
				background-color: black;						
			`
			);
			res.redirect('/data_view');

			return Promise.resolve() as Promise<void>;
		} else {
			res.status(400).send({ message: 'Invalid Credentials!' });

			return Promise.reject() as Promise<void>;
		}
	} catch (error: unknown) {
		console.error(
			`loginPostHandler had an ERROR: ${(error as Error).message}`
		);
		res.status(500).send(`Post Login Error: ${(error as Error).message}`);
		return Promise.reject() as Promise<void>;
	}
}

async function loginPopupHandler(
	req: Request,
	res: Response,
	_next: NextFunction
): Promise<void> {
	try {
		let username: string = '';
		let email: string = '';

		req.body.username = username;
		req.body.email = email;

		const login_popup_utility = `<script type="module" src="/src/utility/appFunction_utilities/login_popup.js" content="text/javascript"></script>`;
		const login_popup_index = `<script type="module" src="/src/ts/login_popup_index.js" content="text/javascript"></script>`;
		res.set('Content-Type', 'text/html');
		res.set('target', '_blank');
		res.render('login_popup', {
			title: 'Login Popup Confirmation',
			layout: 'login_popup_main',
			partials: 'partials',
			helpers: 'helpers',
			script: [login_popup_index],
			script_utility: [login_popup_utility],
			username: username,
			email: email
		});

		console.info(
			`
				%c
				username: ${username},
				email: ${email} 
			`,
			`
				color: chartreuse;
				font-family: 'Titillium Web', sans-serif; 
				font-size: 0.85rem;
				font-weight: bold;
				background-color: black;						
			`
		);

		return Promise.resolve()
			.then(() => {
				console.info(`loginPopupHandler processed`);
			})
			.then(() => {
				if (username) {
					console.info(
						`
							%c
							username: ${username},
							email: ${email} 
						`,
						`
							color: chartreuse;
							font-family: 'Titillium Web', sans-serif; 
							font-size: 0.85rem;
							font-weight: bold;
							background-color: black;						
						`
					);
					return;
				}
			})
			.catch((error: unknown) => {
				console.error(
					`loginFormButton EventListener within the Route Handler: LoginPopupHandler | Type of ERROR: ${error}`
				);
				res.status(500).send(
					`loginFormButton EventListener Error: ${error}`
				);
				return Promise.reject() as Promise<void>;
			}) as Promise<void>;
	} catch (error: unknown) {
		console.error(`loginPopupHandler had an ERROR: ${error}`);
		res.status(500).send(
			`Server Error occurred in the Route Handler called loginPopupHandler | Type of ERROR: ${error}`
		);
		return Promise.reject() as Promise<void>;
	}
}

async function dataViewHandler(req: Request, res: Response): Promise<void> {
	try {
		const viewNumber: number = req.session.views;
		const conn: Connection = await connection();
		const query = `SELECT * FROM users`;
		const users: any = await conn.query(query);
		console.info(`session.data: ${req.session.data}`);

		const data_view_script = `<script type="module" src="/src/ts/data_view.js" content="text/javascript"></script>`;

		res.set('Content-Type', 'text/html');
		res.set('target', '_blank');
		res.render('data_view', {
			views: `<p class="views">| ${viewNumber} |</p>`,
			title: 'MySQL Data View',
			layout: 'data_view_main',
			partials: 'partials',
			helpers: 'helpers',
			script: [data_view_script],
			logged_user: req.body.username,
			user_email: req.body.email,
			users: users[0]
		});

		console.info(
			`
				%c
				data_view handler ::
				req.body.username: ${res.locals.username},
				req.body.email: ${res.locals.email},
				res.locals.username: ${res.locals.username} 
				res.locals.email: ${res.locals.email} 
			`,
			`
				color: chartreuse;
				font-family: 'Titillium Web', sans-serif; 
				font-size: 0.85rem;
				font-weight: bold;
				background-color: black;						
			`
		);

		await conn.end();
		return Promise.resolve() as Promise<void>;
	} catch (error: unknown) {
		console.error(`dataViewHandler had an ERROR: ${error}`);
		res.status(500).send('Server Error');

		return Promise.reject() as Promise<void>;
	}
}

async function logout(req: Request, res: Response): Promise<void> {
	req?.session.destroy((error: unknown) => {
		if (!error) {
			return res.redirect('/');
		}
		sessionStorage.close();
		res.clearCookie(req.body.sessions);
		return res.redirect('/login');
	}) as Session.Session & Partial<Session.SessionData>;
}

async function aboutHandler(_req: Request, res: Response): Promise<void> {
	try {
		res.set('Content-Type', 'text/html');
		res.set('target', '_blank');
		res.render('about', {
			title: 'About',
			layout: 'main',
			partials: 'partials',
			helpers: 'helpers'
		});
		return Promise.resolve() as Promise<void>;
	} catch (error: unknown) {
		console.error(`aboutHandler had an ERROR: ${error}`);
		res.status(500).send('Server Error');

		return Promise.reject() as Promise<void>;
	}
}
export {
	indexHandler as default,
	registerHandler,
	registerPostHandler,
	loginHandler,
	loginPostHandler,
	loginPopupHandler,
	dataViewHandler,
	logout,
	aboutHandler
};
