import { Router, Request, Response, NextFunction } from 'express';
import { getLatestEvents, getStats } from '../../store/database';
import { register } from '../../observability/metrics';

const router = Router();

// GET /events
router.get('/events', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { animal, severity } = req.query;

    const animalFilter = typeof animal === 'string' ? animal : undefined;
    let severityFilter: 'INFO' | 'WARN' | 'ERROR' | undefined;

    if (severity !== undefined) {
      if (typeof severity !== 'string' || !['INFO', 'WARN', 'ERROR'].includes(severity)) {
        return res.status(400).json({
          error: `Invalid severity value: '${severity}'. Must be one of: INFO, WARN, ERROR.`
        });
      }
      severityFilter = severity as 'INFO' | 'WARN' | 'ERROR';
    }

    const events = getLatestEvents(100, animalFilter, severityFilter);
    res.json(events);
  } catch (error) {
    next(error);
  }
});

// GET /stats
router.get('/stats', (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /metrics
router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  } catch (error) {
    next(error);
  }
});

export default router;
