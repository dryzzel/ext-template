<?php
// Disposable Docker test instance only; this file is never shipped in the extension.
require '/var/www/html/bootstrap.php';
$app = new Espo\Core\Application();
$app->getContainer()->getByClass(Espo\Core\ApplicationUser::class)->setupSystemUser();
$em = $app->getContainer()->getByClass(Espo\Core\ORM\EntityManager::class);
$command = $argv[1] ?? '';
$id = $argv[2] ?? '';
if ($command === 'reminders') {
    $list = $em->getRDBRepository('Reminder')->where(['entityType' => 'DovAgentNote', 'entityId' => $id])->find();
    $data = [];
    foreach ($list as $item) { $data[] = $item->getValueMap(); }
    echo json_encode($data);
} elseif ($command === 'age') {
    $query = $em->getQueryBuilder()->update()->in('DovAgentNote')->set(['dateStart' => gmdate('Y-m-d H:i:s', time() - 172800)])->where(['id' => $id])->build();
    $em->getQueryExecutor()->execute($query);
    echo json_encode(['aged' => $id]);
} elseif ($command === 'all-reminders') {
    echo json_encode($em->getRDBRepository('Reminder')->where(['entityType' => 'DovAgentNote'])->count());
} elseif ($command === 'websocket-on') {
    $writer = $app->getContainer()->getByClass(Espo\Core\InjectableFactory::class)->create(Espo\Core\Utils\Config\ConfigWriter::class);
    foreach (['useWebSocket' => true, 'webSocketUrl' => 'ws://localhost:8094', 'webSocketPort' => 8080,
        'webSocketZeroMQSubmissionDsn' => 'tcp://websocket:7777', 'webSocketZeroMQSubscriberDsn' => 'tcp://0.0.0.0:7777'] as $key => $value) {
        $writer->set($key, $value);
    }
    $writer->save();
    echo json_encode(['enabled' => true]);
} elseif ($command === 'submit-popups') {
    $factory = $app->getContainer()->getByClass(Espo\Core\InjectableFactory::class);
    $factory->create(Espo\Modules\Crm\Jobs\SubmitPopupReminders::class)->run();
    echo json_encode(['submitted' => true]);
} else {
    throw new RuntimeException('Unknown test command.');
}
