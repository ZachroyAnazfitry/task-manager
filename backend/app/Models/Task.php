<?php

namespace App\Models;

use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Task extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'status',
        'priority',
        'due_date',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'status' => TaskStatus::class,
            'priority' => TaskPriority::class,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Scope: tasks belonging to the given user (used for listing and scoped route binding). */
    public function scopeForUser(Builder $query, int|string $userId): void
    {
        $query->where('user_id', $userId);
    }

    /** Scope: filter by status. */
    public function scopeStatus(Builder $query, string $status): void
    {
        $query->where('status', $status);
    }

    /** Scope: filter by priority. */
    public function scopePriority(Builder $query, string $priority): void
    {
        $query->where('priority', $priority);
    }

    /** Scope: default order for listing (newest first). */
    public function scopeLatest(Builder $query): void
    {
        $query->orderBy('created_at', 'desc');
    }

    /** @return array<string> */
    public static function statuses(): array
    {
        return TaskStatus::values();
    }

    /** @return array<string> */
    public static function priorities(): array
    {
        return TaskPriority::values();
    }
}
