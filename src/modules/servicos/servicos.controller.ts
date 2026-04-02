import { Request, Response, NextFunction } from "express";
import * as service from "./servicos.service";

function p(val: string | string[]): string { return Array.isArray(val) ? val[0] : val; }

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: any = {};
    if (req.query.cliente_id) filters.cliente_id = parseInt(req.query.cliente_id as string);
    if (req.query.ativo !== undefined) filters.ativo = req.query.ativo === "true";
    if (req.query.status) filters.status = req.query.status;
    if (req.query.busca) filters.busca = req.query.busca;
    res.json(await service.list(filters));
  } catch (err) { next(err); }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.getById(parseInt(p(req.params.id)))); } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.create(req.body)); } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.update(parseInt(p(req.params.id)), req.body)); } catch (err) { next(err); }
}

export async function toggle(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.toggle(parseInt(p(req.params.id)), req.body.ativo)); } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.remove(parseInt(p(req.params.id)))); } catch (err) { next(err); }
}

export async function addLink(req: Request, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.addLink(parseInt(p(req.params.id)), req.body)); } catch (err) { next(err); }
}

export async function removeLink(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.removeLink(parseInt(p(req.params.linkId)))); } catch (err) { next(err); }
}

export async function stats(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.getStats()); } catch (err) { next(err); }
}
