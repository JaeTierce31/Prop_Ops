/* eslint-disable */
// @ts-nocheck
import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AuditRouteImport } from './routes/audit'
import { Route as ManagerRouteImport } from './routes/manager'
import { Route as ReceiptRouteImport } from './routes/receipt'
import { Route as ResidentRouteImport } from './routes/resident'
import { Route as WorkerRouteImport } from './routes/worker'
const IndexRoute = IndexRouteImport.update({ id: '/', path: '/', getParentRoute: () => rootRouteImport } as any)
const AuditRoute = AuditRouteImport.update({ id: '/audit', path: '/audit', getParentRoute: () => rootRouteImport } as any)
const ManagerRoute = ManagerRouteImport.update({ id: '/manager', path: '/manager', getParentRoute: () => rootRouteImport } as any)
const ReceiptRoute = ReceiptRouteImport.update({ id: '/receipt', path: '/receipt', getParentRoute: () => rootRouteImport } as any)
const ResidentRoute = ResidentRouteImport.update({ id: '/resident', path: '/resident', getParentRoute: () => rootRouteImport } as any)
const WorkerRoute = WorkerRouteImport.update({ id: '/worker', path: '/worker', getParentRoute: () => rootRouteImport } as any)
export interface FileRoutesByFullPath {'/':typeof IndexRoute;'/audit':typeof AuditRoute;'/manager':typeof ManagerRoute;'/receipt':typeof ReceiptRoute;'/resident':typeof ResidentRoute;'/worker':typeof WorkerRoute}
export interface FileRoutesByTo extends FileRoutesByFullPath {}
export interface FileRoutesById {__root__:typeof rootRouteImport;'/':typeof IndexRoute;'/audit':typeof AuditRoute;'/manager':typeof ManagerRoute;'/receipt':typeof ReceiptRoute;'/resident':typeof ResidentRoute;'/worker':typeof WorkerRoute}
export interface FileRouteTypes {fileRoutesByFullPath:FileRoutesByFullPath;fullPaths:'/'|'/audit'|'/manager'|'/receipt'|'/resident'|'/worker';fileRoutesByTo:FileRoutesByTo;to:'/'|'/audit'|'/manager'|'/receipt'|'/resident'|'/worker';id:'__root__'|'/'|'/audit'|'/manager'|'/receipt'|'/resident'|'/worker';fileRoutesById:FileRoutesById}
export interface RootRouteChildren {IndexRoute:typeof IndexRoute;AuditRoute:typeof AuditRoute;ManagerRoute:typeof ManagerRoute;ReceiptRoute:typeof ReceiptRoute;ResidentRoute:typeof ResidentRoute;WorkerRoute:typeof WorkerRoute}
declare module '@tanstack/react-router' { interface FileRoutesByPath {'/':{id:'/';path:'/';fullPath:'/';preLoaderRoute:typeof IndexRouteImport;parentRoute:typeof rootRouteImport};'/audit':{id:'/audit';path:'/audit';fullPath:'/audit';preLoaderRoute:typeof AuditRouteImport;parentRoute:typeof rootRouteImport};'/manager':{id:'/manager';path:'/manager';fullPath:'/manager';preLoaderRoute:typeof ManagerRouteImport;parentRoute:typeof rootRouteImport};'/receipt':{id:'/receipt';path:'/receipt';fullPath:'/receipt';preLoaderRoute:typeof ReceiptRouteImport;parentRoute:typeof rootRouteImport};'/resident':{id:'/resident';path:'/resident';fullPath:'/resident';preLoaderRoute:typeof ResidentRouteImport;parentRoute:typeof rootRouteImport};'/worker':{id:'/worker';path:'/worker';fullPath:'/worker';preLoaderRoute:typeof WorkerRouteImport;parentRoute:typeof rootRouteImport}}}
const rootRouteChildren:RootRouteChildren={IndexRoute,AuditRoute,ManagerRoute,ReceiptRoute,ResidentRoute,WorkerRoute}
export const routeTree=rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()
import type { getRouter } from './router.tsx'
import type { startInstance } from './start.ts'
declare module '@tanstack/react-start' { interface Register {ssr:true;router:Awaited<ReturnType<typeof getRouter>>;config:Awaited<ReturnType<typeof startInstance.getOptions>>}}
