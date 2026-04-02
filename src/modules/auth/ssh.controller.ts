import { Request, Response, NextFunction } from "express";
import * as sshService from "./ssh.service";

// Challenge-Response
export async function requestChallenge(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await sshService.createChallenge(req.body.username);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function verifyChallengeResponse(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, challenge, signature } = req.body;
    const result = await sshService.verifyChallenge(username, challenge, signature);

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// Key Management
export async function listKeys(req: Request, res: Response, next: NextFunction) {
  try {
    const keys = await sshService.listSSHKeys(req.user!.userId);
    res.json(keys);
  } catch (err) {
    next(err);
  }
}

export async function addKey(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await sshService.addSSHKey(req.user!.userId, req.body.name, req.body.publicKey);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeKey(req: Request, res: Response, next: NextFunction) {
  try {
    const keyId = parseInt(Array.isArray(req.params.keyId) ? req.params.keyId[0] : req.params.keyId);
    const result = await sshService.deleteSSHKey(req.user!.userId, keyId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
