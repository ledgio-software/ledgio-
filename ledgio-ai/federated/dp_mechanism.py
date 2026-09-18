"""
Gaussian Differential Privacy mechanism for federated gradient updates.

Implements the standard DP-SGD noise addition:
  1. Clip gradient L2 norm to clipping_norm C
  2. Add Gaussian noise N(0, (sigma * C)^2) to each gradient component

With these parameters the update satisfies (epsilon, delta)-DP per round
where the exact epsilon is tracked by budget_tracker.py.
"""

import numpy as np


CLIPPING_NORM: float = 1.0   # C — gradient clipping bound
NOISE_MULTIPLIER: float = 1.0  # σ — noise scale relative to C


def clip_gradient(gradient: np.ndarray, clipping_norm: float = CLIPPING_NORM) -> np.ndarray:
    """Clip gradient so its L2 norm is at most clipping_norm."""
    norm = np.linalg.norm(gradient)
    if norm > clipping_norm:
        return gradient * (clipping_norm / norm)
    return gradient


def add_gaussian_noise(
    gradient: np.ndarray,
    clipping_norm: float = CLIPPING_NORM,
    noise_multiplier: float = NOISE_MULTIPLIER,
) -> np.ndarray:
    """Add calibrated Gaussian noise to a (already-clipped) gradient."""
    sigma = noise_multiplier * clipping_norm
    noise = np.random.normal(0.0, sigma, size=gradient.shape)
    return gradient + noise


def privatize_gradient(
    gradient: np.ndarray,
    clipping_norm: float = CLIPPING_NORM,
    noise_multiplier: float = NOISE_MULTIPLIER,
) -> np.ndarray:
    """Clip then noise a gradient — the full DP-SGD per-sample step."""
    clipped = clip_gradient(gradient, clipping_norm)
    return add_gaussian_noise(clipped, clipping_norm, noise_multiplier)
