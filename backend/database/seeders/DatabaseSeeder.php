<?php

namespace Database\Seeders;

use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public const DEMO_EMAIL = 'demo@example.com';

    public const DEMO_PASSWORD = 'password';

    public const DEMO_TASK_COUNT = 50;

    public function run(): void
    {
        $user = User::firstOrCreate(
            ['email' => self::DEMO_EMAIL],
            [
                'name' => 'Demo User',
                'password' => Hash::make(self::DEMO_PASSWORD),
            ]
        );

        $existingCount = Task::where('user_id', $user->id)->count();
        $toCreate = max(0, self::DEMO_TASK_COUNT - $existingCount);

        if ($toCreate > 0) {
            Task::factory()
                ->count($toCreate)
                ->for($user)
                ->create();
        }
    }
}
