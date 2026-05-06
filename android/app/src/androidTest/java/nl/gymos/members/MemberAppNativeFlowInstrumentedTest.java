package nl.gymos.members;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class MemberAppNativeFlowInstrumentedTest {
    private Instrumentation instrumentation;
    private Activity activity;
    private WebView webView;

    @Before
    public void launchApp() throws Exception {
        instrumentation = InstrumentationRegistry.getInstrumentation();
        Context context = instrumentation.getTargetContext();
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        activity = instrumentation.startActivitySync(intent);
        instrumentation.waitForIdleSync();
        webView = findWebView(activity);
        assertNotNull("Capacitor should render a WebView", webView);
        waitForShell();
        installNativeQaHelpers();
    }

    @After
    public void closeApp() {
        if (activity != null) {
            activity.finish();
        }
    }

    @Test
    public void memberCanNavigateNativeShellSections() throws Exception {
        assertTrue(textContent().contains("Vandaag in je club"));

        tapNav("classes");
        assertFalse(isScreenHidden("classes"));
        assertTrue(textContent().contains("Rooster en vrije plekken"));

        tapNav("pass");
        assertFalse(isScreenHidden("pass"));
        assertTrue(textContent().contains("QR/check-in pass"));

        tapNav("service");
        assertFalse(isScreenHidden("service"));
        assertTrue(textContent().contains("Betaalzaken, pauze en documenten"));

        tapNav("account");
        assertFalse(isScreenHidden("account"));
        assertTrue(textContent().contains("Account verwijderen"));
    }

    @Test
    public void memberJourneyButtonsOpenNativeMemberPanels() throws Exception {
        clickFlow("login");
        waitForBoolean(
            "!document.querySelector('[data-screen=\"account\"]').hidden && !document.querySelector('[data-native-panel=\"native-login\"]').hidden",
            "Expected login to open the native login panel"
        );
        assertTrue(textContent().contains("Sessie beveiligen"));

        clickFlow("reserve");
        waitForBoolean(
            "!document.querySelector('[data-screen=\"classes\"]').hidden && !document.querySelector('[data-native-panel=\"roster\"]').hidden",
            "Expected reserve to open the native roster"
        );
        assertTrue(textContent().contains("Rooster geopend vanuit de native app."));

        clickFlow("cancel-reservation");
        waitForBoolean(
            "!document.querySelector('[data-screen=\"today\"]').hidden && !document.querySelector('[data-native-panel=\"reservation-manager\"]').hidden",
            "Expected planning management to open the native reservation panel"
        );
        assertTrue(textContent().contains("Je reserveringen staan klaar in de app."));

        clickFlow("payments");
        waitForBoolean(
            "!document.querySelector('[data-screen=\"service\"]').hidden && !document.querySelector('[data-native-panel=\"payment-center\"]').hidden",
            "Expected payments to open the native payment center"
        );
        assertTrue(textContent().contains("Betalingsoverzicht geopend in de app."));

        clickFlow("pause-request");
        waitForBoolean(
            "!document.querySelector('[data-screen=\"service\"]').hidden && !document.querySelector('[data-native-panel=\"service-request\"]').hidden",
            "Expected service requests to open the native service panel"
        );
        assertTrue(textContent().contains("Je verzoek staat klaar voor veilige synchronisatie"));

        clickFlow("account-delete");
        waitForBoolean(
            "!document.querySelector('[data-screen=\"account\"]').hidden && !document.querySelector('[data-native-panel=\"account-delete\"]').hidden",
            "Expected account deletion to open the native account panel"
        );
        assertTrue(textContent().contains("Verwijder mijn app-account"));
    }

    @Test
    public void mollieReturnOfflineStateAndAppResumeStayInsideTheNativeShell() throws Exception {
        startUrlCapture();

        evaluate(
            "window.GymOSNativePayments.openPaymentCheckout('https://pay.mollie.com/p/native-qa'); return true;"
        );
        waitForBoolean(
            "window.__GymOSAndroidQa.getPaymentStatus().includes('Betaling veilig geopend')",
            "Expected Mollie checkout to show the native payment-opened state"
        );
        assertTrue(paymentStatus().contains("Betaling veilig geopend"));
        assertTrue(containsUrl(openedUrls(), "https://pay.mollie.com/p/native-qa"));

        evaluate("window.__GymOSAndroidQa.handleAppResume(); return true;");
        waitForBoolean(
            "window.__GymOSAndroidQa.getPaymentStatus().includes('factuurnummer ontbreekt')",
            "Expected app resume to keep payment verification inside the native shell"
        );
        assertTrue(paymentStatus().contains("factuurnummer ontbreekt"));

        evaluate(
            "window.GymOSNativePayments.handlePaymentReturn('gymos://member/payment-return?invoice=inv_qa'); return true;"
        );
        waitForBoolean(
            "!document.querySelector('[data-screen=\"service\"]').hidden && window.__GymOSAndroidQa.getPaymentStatus().includes('Betaling kon nog niet worden gecontroleerd')",
            "Expected Mollie return to route back to the service screen"
        );
        assertFalse(isScreenHidden("service"));
        assertTrue(paymentStatus().contains("Betaling kon nog niet worden gecontroleerd"));

        evaluate("window.__GymOSAndroidQa.simulateNetwork(false); return true;");
        waitForBoolean(
            "document.body.innerText.includes('Offline') && document.querySelector('[data-capability=\"offline\"]').textContent.includes('Offline pas actief')",
            "Expected offline state to expose the offline pass"
        );
        assertTrue(textContent().contains("Offline"));
        assertTrue(capabilityText("offline").contains("Offline pas actief"));

        evaluate("window.__GymOSAndroidQa.simulateNetwork(true); return true;");
        waitForBoolean(
            "document.body.innerText.includes('Online')",
            "Expected online state to recover after offline simulation"
        );
        assertTrue(textContent().contains("Online"));
    }

    private void waitForShell() throws Exception {
        long deadline = System.currentTimeMillis() + 30_000;
        String lastState = "";
        while (System.currentTimeMillis() < deadline) {
            instrumentation.waitForIdleSync();
            lastState = evaluateString(
                "JSON.stringify({" +
                    "ready: document.readyState," +
                    "href: window.location.href," +
                    "payments: typeof window.GymOSNativePayments," +
                    "actions: typeof window.GymOSNativeActions," +
                    "body: (document.body?.innerText || '').slice(0, 120)" +
                "})"
            );
            if (Boolean.TRUE.equals(
                evaluateBoolean(
                    "document.readyState === 'complete' && typeof window.GymOSNativePayments === 'object' && typeof window.GymOSNativeActions === 'object'"
                )
            )) {
                return;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("GymOS native shell did not become ready. Last WebView state: " + lastState);
    }

    private WebView findWebView(Activity currentActivity) {
        AtomicReference<WebView> found = new AtomicReference<>();
        instrumentation.runOnMainSync(
            () -> found.set(findWebViewInTree(currentActivity.getWindow().getDecorView()))
        );
        return found.get();
    }

    private WebView findWebViewInTree(View view) {
        if (view instanceof WebView) {
            return (WebView) view;
        }

        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int index = 0; index < group.getChildCount(); index++) {
                WebView found = findWebViewInTree(group.getChildAt(index));
                if (found != null) {
                    return found;
                }
            }
        }

        return null;
    }

    private String evaluate(String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        instrumentation.runOnMainSync(
            () ->
                webView.evaluateJavascript(
                    "(function () { " + script + " })()",
                    value -> {
                        result.set(value);
                        latch.countDown();
                    }
                )
        );

        if (!latch.await(5, TimeUnit.SECONDS)) {
            throw new AssertionError("Timed out while evaluating JavaScript: " + script);
        }

        return result.get();
    }

    private String evaluateString(String script) throws Exception {
        String raw = evaluate("return (" + script + ");");
        if (raw == null || raw.equals("null")) {
            return "";
        }
        return new JSONArray("[" + raw + "]").getString(0);
    }

    private Boolean evaluateBoolean(String script) throws Exception {
        return Boolean.valueOf(evaluate("return (" + script + ");"));
    }

    private void installNativeQaHelpers() throws Exception {
        evaluate(
            "window.__GymOSAndroidQaOpenedUrls = [];" +
            "const captureUrl = (url) => {" +
                "window.__GymOSAndroidQaOpenedUrls.push(String(url));" +
                "return { closed: false };" +
            "};" +
            "const browser = window.Capacitor?.Plugins?.Browser;" +
            "if (browser) {" +
                "browser.open = async (options) => {" +
                    "captureUrl(options?.url || options);" +
                    "return undefined;" +
                "};" +
            "}" +
            "window.open = (url) => captureUrl(url);" +
            "window.__GymOSAndroidQa = {" +
                "getPaymentStatus: () => document.querySelector('[data-payment-status]')?.textContent || ''," +
                "startUrlCapture: () => { window.__GymOSAndroidQaOpenedUrls = []; }," +
                "getOpenedUrls: () => window.__GymOSAndroidQaOpenedUrls || []," +
                "handleAppResume: () => window.GymOSNativePayments.handleAppResume()," +
                "simulateNetwork: async (isOnline) => {" +
                    "const label = isOnline ? 'Online' : 'Offline';" +
                    "document.querySelector('[data-network-status]').textContent = label;" +
                    "document.querySelector('[data-capability=\"offline\"]').textContent = isOnline ? 'Laatste pas lokaal bewaard' : 'Offline pas actief';" +
                "}," +
            "};" +
            "return true;"
        );
    }

    private void waitForBoolean(String script, String message) throws Exception {
        long deadline = System.currentTimeMillis() + 5_000;
        while (System.currentTimeMillis() < deadline) {
            if (Boolean.TRUE.equals(evaluateBoolean(script))) {
                return;
            }
            Thread.sleep(100);
        }
        throw new AssertionError(message);
    }

    private void tapNav(String screen) throws Exception {
        evaluate(
            "document.querySelector('[data-nav=\"" + screen + "\"]').click(); return true;"
        );
    }

    private void clickFlow(String flow) throws Exception {
        evaluate(
            "document.querySelector('[data-qa-flow=\"" + flow + "\"]').click(); return true;"
        );
    }

    private boolean isScreenHidden(String screen) throws Exception {
        return evaluateBoolean(
            "document.querySelector('[data-screen=\"" + screen + "\"]').hidden"
        );
    }

    private String textContent() throws Exception {
        return evaluateString("document.body.innerText");
    }

    private String capabilityText(String capability) throws Exception {
        return evaluateString(
            "document.querySelector('[data-capability=\"" + capability + "\"]').textContent"
        );
    }

    private String paymentStatus() throws Exception {
        return evaluateString("window.__GymOSAndroidQa.getPaymentStatus()");
    }

    private void startUrlCapture() throws Exception {
        evaluate("window.__GymOSAndroidQa.startUrlCapture(); return true;");
    }

    private JSONArray openedUrls() throws Exception {
        return new JSONArray(
            evaluateString("JSON.stringify(window.__GymOSAndroidQa.getOpenedUrls())")
        );
    }

    private boolean containsUrl(JSONArray urls, String expectedUrl) throws Exception {
        for (int index = 0; index < urls.length(); index++) {
            if (expectedUrl.equals(urls.getString(index))) {
                return true;
            }
        }
        return false;
    }
}
