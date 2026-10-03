package com.nalamudan.healthtracker

import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.format.DateTimeFormatter

@CapacitorPlugin(name = "HealthConnectPlugin")
class HealthConnectPlugin : Plugin() {

    private val scope = CoroutineScope(Dispatchers.IO)
    private val fmt   = DateTimeFormatter.ISO_INSTANT

    private var pendingPermissionCall: PluginCall? = null
    private var permissionLauncher: ActivityResultLauncher<Set<String>>? = null

    private val PERMISSIONS = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
        HealthPermission.getReadPermission(OxygenSaturationRecord::class),
        HealthPermission.getReadPermission(RespiratoryRateRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(Vo2MaxRecord::class),
    )

    override fun load() {
        // Register the permission launcher unconditionally at plugin load time.
        // Must be registered before the activity is started (Capacitor calls load() early).
        // We guard with a try/catch: if HC is completely unavailable the launcher
        // registration will fail gracefully and requestPermissions() will reject.
        try {
            val contract = HealthConnectClient.getOrCreate(context)
                .permissionController
                .createRequestPermissionResultContract()
            permissionLauncher = activity.registerForActivityResult(contract) { granted ->
                val call = pendingPermissionCall ?: return@registerForActivityResult
                pendingPermissionCall = null
                val arr = JSArray()
                granted.forEach { arr.put(it) }
                val res = JSObject()
                res.put("granted", arr)
                call.resolve(res)
            }
        } catch (e: Exception) {
            // HC not available on this device — permissionLauncher stays null.
            // checkAvailability() will return NOT_SUPPORTED and the UI will handle it.
            android.util.Log.w("HealthConnectPlugin", "HC not available at load(): ${e.message}")
        }
    }

    private fun getClientOrNull(): HealthConnectClient? {
        val status = HealthConnectClient.getSdkStatus(
            context, HealthConnectClient.DEFAULT_PROVIDER_PACKAGE_NAME
        )
        return if (status == HealthConnectClient.SDK_AVAILABLE)
            HealthConnectClient.getOrCreate(context)
        else null
    }

    // ── checkAvailability ────────────────────────────────────────────────────

    @PluginMethod
    fun checkAvailability(call: PluginCall) {
        val providerPackage = HealthConnectClient.DEFAULT_PROVIDER_PACKAGE_NAME
        val status = HealthConnectClient.getSdkStatus(context, providerPackage)
        val res = JSObject()
        res.put("sdkStatus", status)
        res.put("status", when (status) {
            HealthConnectClient.SDK_AVAILABLE                             -> "AVAILABLE"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "UPDATE_REQUIRED"
            else                                                          -> "NOT_SUPPORTED"
        })
        call.resolve(res)
    }

    // ── requestPermissions ───────────────────────────────────────────────────

    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        val client = getClientOrNull() ?: run {
            call.reject("Health Connect not available on this device")
            return
        }
        val launcher = permissionLauncher ?: run {
            call.reject("Permission launcher not initialised — call load() first")
            return
        }

        scope.launch(Dispatchers.Main) {
            try {
                val already = client.permissionController.getGrantedPermissions()
                val missing = PERMISSIONS - already
                if (missing.isEmpty()) {
                    // All already granted — resolve immediately
                    val arr = JSArray()
                    already.forEach { arr.put(it) }
                    val res = JSObject(); res.put("granted", arr)
                    call.resolve(res)
                    return@launch
                }
                // Launch the official HC permission screen
                pendingPermissionCall = call
                launcher.launch(PERMISSIONS)
            } catch (e: Exception) {
                call.reject("Permission request failed: ${e.message}")
            }
        }
    }

    // ── getGrantedPermissions ────────────────────────────────────────────────

    @PluginMethod
    fun getGrantedPermissions(call: PluginCall) {
        val client = getClientOrNull() ?: run {
            val res = JSObject(); res.put("granted", JSArray()); call.resolve(res); return
        }
        scope.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                val arr = JSArray()
                granted.forEach { arr.put(it) }
                val res = JSObject(); res.put("granted", arr)
                call.resolve(res)
            } catch (e: Exception) {
                val res = JSObject(); res.put("granted", JSArray()); call.resolve(res)
            }
        }
    }

    // ── openHealthConnectSettings ────────────────────────────────────────────

    @PluginMethod
    fun openHealthConnectSettings(call: PluginCall) {
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("healthconnect://")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            // Fallback: open HC app directly
            val fallback = context.packageManager
                .getLaunchIntentForPackage("com.google.android.apps.healthdata")
            activity.startActivity(fallback ?: intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Could not open Health Connect settings: ${e.message}")
        }
    }

    // ── readHealthData ───────────────────────────────────────────────────────

    @PluginMethod
    fun readHealthData(call: PluginCall) {
        val client = getClientOrNull() ?: run { call.reject("Health Connect not available"); return }
        val startTime = Instant.parse(call.getString("startTime") ?: Instant.now().minusSeconds(86400L * 30).toString())
        val endTime   = Instant.parse(call.getString("endTime")   ?: Instant.now().toString())
        val filter    = TimeRangeFilter.between(startTime, endTime)

        scope.launch {
            try {
                val records = JSArray()

                safeRead(client, ReadRecordsRequest(StepsRecord::class, filter)) { r ->
                    records.put(JSObject().apply {
                        put("type", "steps"); put("value", r.count.toDouble()); put("unit", "steps")
                        put("startTime", fmt.format(r.startTime)); put("endTime", fmt.format(r.endTime))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                safeRead(client, ReadRecordsRequest(HeartRateRecord::class, filter)) { r ->
                    r.samples.forEach { s ->
                        records.put(JSObject().apply {
                            put("type", "heart_rate"); put("value", s.beatsPerMinute.toDouble()); put("unit", "bpm")
                            put("startTime", fmt.format(s.time))
                            put("uid", "${r.metadata.id}_${s.time.epochSecond}")
                            put("dataOrigin", r.metadata.dataOrigin.packageName)
                        })
                    }
                }

                safeRead(client, ReadRecordsRequest(RestingHeartRateRecord::class, filter)) { r ->
                    records.put(JSObject().apply {
                        put("type", "resting_heart_rate"); put("value", r.beatsPerMinute.toDouble()); put("unit", "bpm")
                        put("startTime", fmt.format(r.time))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                safeRead(client, ReadRecordsRequest(HeartRateVariabilityRmssdRecord::class, filter)) { r ->
                    records.put(JSObject().apply {
                        put("type", "heart_rate_variability"); put("value", r.heartRateVariabilityMillis); put("unit", "ms")
                        put("startTime", fmt.format(r.time))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                safeRead(client, ReadRecordsRequest(OxygenSaturationRecord::class, filter)) { r ->
                    records.put(JSObject().apply {
                        put("type", "oxygen_saturation"); put("value", r.percentage.value); put("unit", "%")
                        put("startTime", fmt.format(r.time))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                safeRead(client, ReadRecordsRequest(RespiratoryRateRecord::class, filter)) { r ->
                    records.put(JSObject().apply {
                        put("type", "respiratory_rate"); put("value", r.rate); put("unit", "rpm")
                        put("startTime", fmt.format(r.time))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                safeRead(client, ReadRecordsRequest(ActiveCaloriesBurnedRecord::class, filter)) { r ->
                    records.put(JSObject().apply {
                        put("type", "active_calories"); put("value", r.energy.inKilocalories); put("unit", "kcal")
                        put("startTime", fmt.format(r.startTime)); put("endTime", fmt.format(r.endTime))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                safeRead(client, ReadRecordsRequest(DistanceRecord::class, filter)) { r ->
                    records.put(JSObject().apply {
                        put("type", "distance"); put("value", r.distance.inKilometers); put("unit", "km")
                        put("startTime", fmt.format(r.startTime)); put("endTime", fmt.format(r.endTime))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                safeRead(client, ReadRecordsRequest(Vo2MaxRecord::class, filter)) { r ->
                    records.put(JSObject().apply {
                        put("type", "vo2_max"); put("value", r.vo2MillilitersPerMinuteKilogram); put("unit", "ml/kg/min")
                        put("startTime", fmt.format(r.time))
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }

                val res = JSObject(); res.put("records", records)
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Failed to read health data: ${e.message}")
            }
        }
    }

    // ── readSleepSessions ────────────────────────────────────────────────────

    @PluginMethod
    fun readSleepSessions(call: PluginCall) {
        val client = getClientOrNull() ?: run { call.reject("Health Connect not available"); return }
        val startTime = Instant.parse(call.getString("startTime") ?: Instant.now().minusSeconds(86400L * 30).toString())
        val endTime   = Instant.parse(call.getString("endTime")   ?: Instant.now().toString())
        val filter    = TimeRangeFilter.between(startTime, endTime)

        scope.launch {
            try {
                val sessions = JSArray()
                safeRead(client, ReadRecordsRequest(SleepSessionRecord::class, filter)) { r ->
                    val durationMin = (r.endTime.epochSecond - r.startTime.epochSecond) / 60.0
                    var awake = 0.0; var light = 0.0; var deep = 0.0; var rem = 0.0
                    r.stages.forEach { stage ->
                        val mins = (stage.endTime.epochSecond - stage.startTime.epochSecond) / 60.0
                        when (stage.stage) {
                            SleepSessionRecord.STAGE_TYPE_AWAKE -> awake += mins
                            SleepSessionRecord.STAGE_TYPE_LIGHT -> light += mins
                            SleepSessionRecord.STAGE_TYPE_DEEP  -> deep  += mins
                            SleepSessionRecord.STAGE_TYPE_REM   -> rem   += mins
                        }
                    }
                    sessions.put(JSObject().apply {
                        put("startTime", fmt.format(r.startTime)); put("endTime", fmt.format(r.endTime))
                        put("durationMinutes", durationMin)
                        if (awake > 0) put("awakeMinutes", awake)
                        if (light > 0) put("lightSleepMinutes", light)
                        if (deep  > 0) put("deepSleepMinutes",  deep)
                        if (rem   > 0) put("remSleepMinutes",   rem)
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }
                val res = JSObject(); res.put("sessions", sessions)
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Failed to read sleep data: ${e.message}")
            }
        }
    }

    // ── readWorkouts ─────────────────────────────────────────────────────────

    @PluginMethod
    fun readWorkouts(call: PluginCall) {
        val client = getClientOrNull() ?: run { call.reject("Health Connect not available"); return }
        val startTime = Instant.parse(call.getString("startTime") ?: Instant.now().minusSeconds(86400L * 30).toString())
        val endTime   = Instant.parse(call.getString("endTime")   ?: Instant.now().toString())
        val filter    = TimeRangeFilter.between(startTime, endTime)

        scope.launch {
            try {
                val workouts = JSArray()
                safeRead(client, ReadRecordsRequest(ExerciseSessionRecord::class, filter)) { r ->
                    val durationMin = (r.endTime.epochSecond - r.startTime.epochSecond) / 60.0
                    workouts.put(JSObject().apply {
                        put("startTime", fmt.format(r.startTime)); put("endTime", fmt.format(r.endTime))
                        put("durationMinutes", durationMin)
                        put("exerciseType", r.exerciseType.toString())
                        put("uid", r.metadata.id); put("dataOrigin", r.metadata.dataOrigin.packageName)
                    })
                }
                val res = JSObject(); res.put("workouts", workouts)
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Failed to read workouts: ${e.message}")
            }
        }
    }

    // ── Helper: safe per-type read (skips if permission not granted) ─────────

    private suspend fun <T : Record> safeRead(
        client: HealthConnectClient,
        request: ReadRecordsRequest<T>,
        block: (T) -> Unit
    ) {
        try {
            client.readRecords(request).records.forEach(block)
        } catch (_: Exception) {
            // Permission not granted for this type — skip silently
        }
    }
}
